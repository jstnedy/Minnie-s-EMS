from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from zoneinfo import ZoneInfo

# Philippines timezone
PH_TZ = ZoneInfo("Asia/Manila")
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-12345')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Use Argon2 instead of bcrypt to avoid 72-byte limitation
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# MODELS
# ============================================================================

class Admin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str  # hashed
    role: str = "admin"  # "admin" or "supervisor"
    forcePasswordChange: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class Role(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class Employee(BaseModel):
    id: str
    fullName: str
    email: str
    phone: str
    address: str
    status: str  # Active/Inactive
    roleId: str
    payType: str = "Hourly"  # Locked to Hourly
    payRate: float
    dateHired: str
    sssEnabled: bool = True  # SSS deduction enabled by default
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class AttendanceRecord(BaseModel):
    id: str
    employeeId: str
    date: str
    timeIn: str
    timeOut: Optional[str] = None
    regularHours: Optional[float] = None
    overtimeHours: Optional[float] = 0.0  # Manual overtime entry
    totalHours: Optional[float] = None
    notes: str = ""
    status: str = "ACTIVE"  # ACTIVE, COMPLETE
    isLocked: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class CorrectionRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    attendanceId: str
    requestedBy: str  # username
    requestedTimeIn: str
    requestedTimeOut: Optional[str] = None
    reason: str
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED
    reviewedBy: Optional[str] = None
    reviewedAt: Optional[datetime] = None
    reviewNotes: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str  # CLOCK_IN, CLOCK_OUT, CORRECTION_REQUEST, CORRECTION_APPROVED, CORRECTION_REJECTED
    performedBy: str  # username
    targetId: str  # attendance or correction request ID
    beforeValues: Optional[dict] = None
    afterValues: Optional[dict] = None
    reason: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(PH_TZ))
    ipAddress: Optional[str] = None


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    username: str
    role: str  # Added role
    forcePasswordChange: bool

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

class CorrectionRequestCreate(BaseModel):
    attendanceId: str
    requestedTimeIn: str
    requestedTimeOut: Optional[str] = None
    reason: str

class CorrectionRequestReview(BaseModel):
    action: str  # "approve" or "reject"
    reviewNotes: Optional[str] = None

class RoleCreate(BaseModel):
    name: str

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Role name cannot be empty')
        return v.strip()

class RoleUpdate(BaseModel):
    name: str

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Role name cannot be empty')
        return v.strip()

class EmployeeCreate(BaseModel):
    fullName: str
    email: str
    phone: str
    address: str
    status: str
    roleId: str
    payRate: float
    dateHired: str
    sssEnabled: bool = True

class EmployeeUpdate(BaseModel):
    fullName: str
    email: str
    phone: str
    address: str
    status: str
    roleId: str
    payRate: float
    dateHired: str
    sssEnabled: bool = True

class ClockInRequest(BaseModel):
    employeeId: str
    notes: str = ""

class ClockOutRequest(BaseModel):
    recordId: str
    notes: str = ""

class AttendanceUpdate(BaseModel):
    timeIn: str
    timeOut: Optional[str] = None
    overtimeHours: Optional[float] = 0.0
    notes: str = ""


# ============================================================================
# SSS DEDUCTION CALCULATOR (Philippines 2024)
# ============================================================================

def calculate_sss_contribution(monthly_salary: float) -> dict:
    """
    Calculate SSS contribution based on Philippines 2024 rates
    Returns dict with employee share, employer share, and total
    """
    # SSS Contribution Table 2024 (Monthly Salary Credit)
    sss_table = [
        (4250, 180.00, 390.00),
        (4750, 202.50, 437.50),
        (5250, 225.00, 485.00),
        (5750, 247.50, 532.50),
        (6250, 270.00, 580.00),
        (6750, 292.50, 627.50),
        (7250, 315.00, 675.00),
        (7750, 337.50, 722.50),
        (8250, 360.00, 770.00),
        (8750, 382.50, 817.50),
        (9250, 405.00, 865.00),
        (9750, 427.50, 912.50),
        (10250, 450.00, 960.00),
        (10750, 472.50, 1007.50),
        (11250, 495.00, 1055.00),
        (11750, 517.50, 1102.50),
        (12250, 540.00, 1150.00),
        (12750, 562.50, 1197.50),
        (13250, 585.00, 1245.00),
        (13750, 607.50, 1292.50),
        (14250, 630.00, 1340.00),
        (14750, 652.50, 1387.50),
        (15250, 675.00, 1435.00),
        (15750, 697.50, 1482.50),
        (16250, 720.00, 1530.00),
        (16750, 742.50, 1577.50),
        (17250, 765.00, 1625.00),
        (17750, 787.50, 1672.50),
        (18250, 810.00, 1720.00),
        (18750, 832.50, 1767.50),
        (19250, 855.00, 1815.00),
        (19750, 877.50, 1862.50),
        (20250, 900.00, 1910.00),
        (20750, 922.50, 1957.50),
        (21250, 945.00, 2005.00),
        (21750, 967.50, 2052.50),
        (22250, 990.00, 2100.00),
        (22750, 1012.50, 2147.50),
        (23250, 1035.00, 2195.00),
        (23750, 1057.50, 2242.50),
        (24250, 1080.00, 2290.00),
        (24750, 1102.50, 2337.50),
        (25250, 1125.00, 2385.00),
        (25750, 1147.50, 2432.50),
        (26250, 1170.00, 2480.00),
        (26750, 1192.50, 2527.50),
        (27250, 1215.00, 2575.00),
        (27750, 1237.50, 2622.50),
        (28250, 1260.00, 2670.00),
        (28750, 1282.50, 2717.50),
        (29250, 1305.00, 2765.00),
        (float('inf'), 1350.00, 2865.00),  # Maximum
    ]
    
    employee_share = 0
    employer_share = 0
    
    for bracket_max, ee_contribution, er_contribution in sss_table:
        if monthly_salary <= bracket_max:
            employee_share = ee_contribution
            employer_share = er_contribution
            break
    
    return {
        "employee_share": employee_share,
        "employer_share": employer_share,
        "total_contribution": employee_share + employer_share,
        "monthly_salary_credit": min(monthly_salary, 30000)  # Max MSC is 30,000
    }


# ============================================================================
# AUTHENTICATION HELPERS
# ============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        admin = await db.admins.find_one({"username": username})
        if admin is None:
            raise HTTPException(status_code=401, detail="Admin not found")
        
        return admin
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


# ============================================================================
# STARTUP - CREATE DEFAULT ADMIN
# ============================================================================

@app.on_event("startup")
async def startup_db():
    # Create default admin if no admins exist
    admin_count = await db.admins.count_documents({})
    if admin_count == 0:
        # Create admin user
        default_admin = Admin(
            username="admin",
            password=pwd_context.hash("admin123"),
            role="admin",
            forcePasswordChange=True
        )
        await db.admins.insert_one(default_admin.dict())
        logger.info("Created default admin user: admin/admin123")
        
        # Create supervisor user
        supervisor = Admin(
            username="supervisor",
            password=pwd_context.hash("supervisor123"),
            role="supervisor",
            forcePasswordChange=True
        )
        await db.admins.insert_one(supervisor.dict())
        logger.info("Created supervisor user: supervisor/supervisor123")
    
    # Create indexes
    await db.roles.create_index("name", unique=True)
    await db.admins.create_index("username", unique=True)
    await db.employees.create_index("id", unique=True)


# ============================================================================
# AUTH ROUTES
# ============================================================================

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    admin = await db.admins.find_one({"username": request.username})
    if not admin or not verify_password(request.password, admin["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": admin["username"]})
    return LoginResponse(
        token=access_token,
        username=admin["username"],
        role=admin.get("role", "admin"),
        forcePasswordChange=admin.get("forcePasswordChange", False)
    )

@api_router.post("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_admin: dict = Depends(get_current_admin)
):
    # Verify current password
    if not verify_password(request.currentPassword, current_admin["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    new_hashed_password = get_password_hash(request.newPassword)
    await db.admins.update_one(
        {"username": current_admin["username"]},
        {
            "$set": {
                "password": new_hashed_password,
                "forcePasswordChange": False,
                "updatedAt": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me")
async def get_me(current_admin: dict = Depends(get_current_admin)):
    return {
        "username": current_admin["username"],
        "role": current_admin.get("role", "admin"),
        "forcePasswordChange": current_admin.get("forcePasswordChange", False)
    }


# ============================================================================
# ROLE ROUTES (PROTECTED)
# ============================================================================

@api_router.get("/roles", response_model=List[Role])
async def get_roles(
    activeOnly: bool = False,
    current_admin: dict = Depends(get_current_admin)
):
    query = {"isActive": True} if activeOnly else {}
    roles = await db.roles.find(query).to_list(1000)
    return [Role(**role) for role in roles]

@api_router.post("/roles", response_model=Role)
async def create_role(
    role_create: RoleCreate,
    current_admin: dict = Depends(get_current_admin)
):
    # Check if role name already exists (case-insensitive) - escape regex special chars
    import re
    escaped_name = re.escape(role_create.name)
    existing = await db.roles.find_one({"name": {"$regex": f"^{escaped_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name already exists"
        )
    
    role = Role(name=role_create.name)
    await db.roles.insert_one(role.dict())
    return role

@api_router.put("/roles/{role_id}", response_model=Role)
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    # Check if role exists
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Check if new name conflicts with another role (case-insensitive)
    existing = await db.roles.find_one({
        "name": {"$regex": f"^{role_update.name}$", "$options": "i"},
        "id": {"$ne": role_id}
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name already exists"
        )
    
    # Update role
    await db.roles.update_one(
        {"id": role_id},
        {
            "$set": {
                "name": role_update.name,
                "updatedAt": datetime.utcnow()
            }
        }
    )
    
    updated_role = await db.roles.find_one({"id": role_id})
    return Role(**updated_role)

@api_router.patch("/roles/{role_id}/toggle")
async def toggle_role_active(
    role_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    new_active_status = not role.get("isActive", True)
    await db.roles.update_one(
        {"id": role_id},
        {
            "$set": {
                "isActive": new_active_status,
                "updatedAt": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Role {'activated' if new_active_status else 'deactivated'} successfully"}

@api_router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    # Check if role is used by any employee
    employee_count = await db.employees.count_documents({"roleId": role_id})
    if employee_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role. {employee_count} employee(s) are assigned to this role."
        )
    
    result = await db.roles.delete_one({"id": role_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"message": "Role deleted successfully"}


# ============================================================================
# EMPLOYEE ROUTES (PROTECTED)
# ============================================================================

@api_router.get("/employees", response_model=List[Employee])
async def get_employees(current_admin: dict = Depends(get_current_admin)):
    employees = await db.employees.find().to_list(1000)
    return [Employee(**emp) for emp in employees]

@api_router.post("/employees", response_model=Employee)
async def create_employee(
    employee_create: EmployeeCreate,
    current_admin: dict = Depends(get_current_admin)
):
    # Verify role exists and is active
    role = await db.roles.find_one({"id": employee_create.roleId})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if not role.get("isActive", True):
        raise HTTPException(status_code=400, detail="Cannot assign inactive role")
    
    # Generate employee ID
    emp_count = await db.employees.count_documents({})
    emp_id = f"EMP-{str(emp_count + 1).zfill(3)}"
    
    employee = Employee(
        id=emp_id,
        fullName=employee_create.fullName,
        email=employee_create.email,
        phone=employee_create.phone,
        address=employee_create.address,
        status=employee_create.status,
        roleId=employee_create.roleId,
        payType="Hourly",
        payRate=employee_create.payRate,
        dateHired=employee_create.dateHired
    )
    
    await db.employees.insert_one(employee.dict())
    return employee

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(
    employee_id: str,
    employee_update: EmployeeUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    # Check if employee exists
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Verify role exists (can be inactive if employee already had it)
    role = await db.roles.find_one({"id": employee_update.roleId})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Update employee
    await db.employees.update_one(
        {"id": employee_id},
        {
            "$set": {
                "fullName": employee_update.fullName,
                "email": employee_update.email,
                "phone": employee_update.phone,
                "address": employee_update.address,
                "status": employee_update.status,
                "roleId": employee_update.roleId,
                "payRate": employee_update.payRate,
                "dateHired": employee_update.dateHired,
                "updatedAt": datetime.utcnow()
            }
        }
    )
    
    updated_employee = await db.employees.find_one({"id": employee_id})
    return Employee(**updated_employee)

@api_router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"message": "Employee deleted successfully"}


# ============================================================================
# ATTENDANCE ROUTES (PROTECTED)
# ============================================================================

@api_router.get("/attendance", response_model=List[AttendanceRecord])
async def get_attendance(
    employeeId: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    current_admin: dict = Depends(get_current_admin)
):
    query = {}
    if employeeId:
        query["employeeId"] = employeeId
    if startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    
    records = await db.attendance.find(query).to_list(1000)
    return [AttendanceRecord(**rec) for rec in records]

@api_router.post("/attendance/clock-in", response_model=AttendanceRecord)
async def clock_in(
    request: ClockInRequest,
    current_admin: dict = Depends(get_current_admin)
):
    # Check if employee exists
    employee = await db.employees.find_one({"id": request.employeeId})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if already clocked in
    open_shift = await db.attendance.find_one({
        "employeeId": request.employeeId,
        "timeOut": None
    })
    if open_shift:
        raise HTTPException(status_code=400, detail="Employee is already clocked in")
    
    # Use Philippines time
    now = datetime.now(PH_TZ)
    record = AttendanceRecord(
        id=f"ATT-{now.timestamp()}-{uuid.uuid4().hex[:4]}",
        employeeId=request.employeeId,
        date=now.strftime("%Y-%m-%d"),
        timeIn=now.isoformat(),
        notes=request.notes
    )
    
    await db.attendance.insert_one(record.dict())
    return record

@api_router.post("/attendance/clock-out", response_model=AttendanceRecord)
async def clock_out(
    request: ClockOutRequest,
    current_admin: dict = Depends(get_current_admin)
):
    record = await db.attendance.find_one({"id": request.recordId})
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    if record.get("timeOut"):
        raise HTTPException(status_code=400, detail="Already clocked out")
    
    # Use Philippines time
    now = datetime.now(PH_TZ)
    time_in = datetime.fromisoformat(record["timeIn"].replace('Z', '+00:00'))
    regular_hours = round((now - time_in).total_seconds() / 3600, 2)
    overtime_hours = record.get("overtimeHours", 0.0)  # Get existing overtime or 0
    total_hours = regular_hours + overtime_hours
    
    await db.attendance.update_one(
        {"id": request.recordId},
        {
            "$set": {
                "timeOut": now.isoformat(),
                "regularHours": regular_hours,
                "totalHours": total_hours,
                "notes": request.notes,
                "status": "COMPLETE",  # Mark as complete
                "updatedAt": datetime.now(PH_TZ)
            }
        }
    )
    
    # Create audit log
    audit_log = AuditLog(
        action="CLOCK_OUT",
        performedBy=current_admin["username"],
        targetId=request.recordId,
        beforeValues={"timeOut": None},
        afterValues={"timeOut": now.isoformat(), "regularHours": regular_hours, "totalHours": total_hours}
    )
    await db.audit_logs.insert_one(audit_log.dict())
    
    updated_record = await db.attendance.find_one({"id": request.recordId})
    return AttendanceRecord(**updated_record)

@api_router.put("/attendance/{record_id}", response_model=AttendanceRecord)
async def update_attendance(
    record_id: str,
    attendance_update: AttendanceUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    record = await db.attendance.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    # Calculate regular hours and total hours
    regular_hours = None
    total_hours = None
    overtime_hours = attendance_update.overtimeHours or 0.0
    
    if attendance_update.timeOut:
        time_in = datetime.fromisoformat(attendance_update.timeIn.replace('Z', '+00:00'))
        time_out = datetime.fromisoformat(attendance_update.timeOut.replace('Z', '+00:00'))
        regular_hours = round((time_out - time_in).total_seconds() / 3600, 2)
        total_hours = regular_hours + overtime_hours
    
    await db.attendance.update_one(
        {"id": record_id},
        {
            "$set": {
                "timeIn": attendance_update.timeIn,
                "timeOut": attendance_update.timeOut,
                "regularHours": regular_hours,
                "overtimeHours": overtime_hours,
                "totalHours": total_hours,
                "notes": attendance_update.notes,
                "updatedAt": datetime.now(PH_TZ)
            }
        }
    )
    
    updated_record = await db.attendance.find_one({"id": record_id})
    return AttendanceRecord(**updated_record)

@api_router.get("/attendance/clocked-in")
async def get_clocked_in_employees(current_admin: dict = Depends(get_current_admin)):
    records = await db.attendance.find({"timeOut": None}).to_list(1000)
    employee_ids = [rec["employeeId"] for rec in records]
    return {"employeeIds": employee_ids}


# ============================================================================


# ============================================================================
# CORRECTION REQUEST ROUTES (PROTECTED)
# ============================================================================

@api_router.post("/correction-requests", response_model=CorrectionRequest)
async def create_correction_request(
    request: CorrectionRequestCreate,
    current_admin: dict = Depends(get_current_admin)
):
    # Only supervisors can create correction requests
    if current_admin.get("role") != "supervisor":
        raise HTTPException(status_code=403, detail="Only supervisors can create correction requests")
    
    # Verify attendance record exists and is complete
    attendance = await db.attendance.find_one({"id": request.attendanceId})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    if attendance.get("status") != "COMPLETE":
        raise HTTPException(status_code=400, detail="Can only request corrections for completed records")
    
    if attendance.get("isLocked"):
        raise HTTPException(status_code=400, detail="Cannot modify locked attendance records")
    
    # Create correction request
    correction = CorrectionRequest(
        attendanceId=request.attendanceId,
        requestedBy=current_admin["username"],
        requestedTimeIn=request.requestedTimeIn,
        requestedTimeOut=request.requestedTimeOut,
        reason=request.reason,
        status="PENDING"
    )
    
    await db.correction_requests.insert_one(correction.dict())
    
    # Create audit log
    audit_log = AuditLog(
        action="CORRECTION_REQUEST",
        performedBy=current_admin["username"],
        targetId=correction.id,
        afterValues={
            "requestedTimeIn": request.requestedTimeIn,
            "requestedTimeOut": request.requestedTimeOut,
            "reason": request.reason
        },
        reason=request.reason
    )
    await db.audit_logs.insert_one(audit_log.dict())
    
    return correction

@api_router.get("/correction-requests", response_model=List[CorrectionRequest])
async def get_correction_requests(
    status: Optional[str] = None,
    current_admin: dict = Depends(get_current_admin)
):
    query = {}
    
    # Supervisors can only see their own requests
    if current_admin.get("role") == "supervisor":
        query["requestedBy"] = current_admin["username"]
    
    # Filter by status if provided
    if status:
        query["status"] = status
    
    requests = await db.correction_requests.find(query).to_list(1000)
    return [CorrectionRequest(**req) for req in requests]

@api_router.post("/correction-requests/{request_id}/review")
async def review_correction_request(
    request_id: str,
    review: CorrectionRequestReview,
    current_admin: dict = Depends(get_current_admin)
):
    # Only admins can review
    if current_admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can review correction requests")
    
    # Get correction request
    correction = await db.correction_requests.find_one({"id": request_id})
    if not correction:
        raise HTTPException(status_code=404, detail="Correction request not found")
    
    if correction["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="This request has already been reviewed")
    
    # Check if admin is trying to approve their own request
    if correction["requestedBy"] == current_admin["username"]:
        raise HTTPException(status_code=403, detail="Cannot approve your own correction request")
    
    now = datetime.now(PH_TZ)
    
    if review.action.lower() == "approve":
        # Update the attendance record
        attendance = await db.attendance.find_one({"id": correction["attendanceId"]})
        
        # Calculate new total hours
        time_in = datetime.fromisoformat(correction["requestedTimeIn"].replace('Z', '+00:00'))
        time_out = datetime.fromisoformat(correction["requestedTimeOut"].replace('Z', '+00:00')) if correction["requestedTimeOut"] else None
        total_hours = round((time_out - time_in).total_seconds() / 3600, 2) if time_out else None
        
        await db.attendance.update_one(
            {"id": correction["attendanceId"]},
            {
                "$set": {
                    "timeIn": correction["requestedTimeIn"],
                    "timeOut": correction["requestedTimeOut"],
                    "totalHours": total_hours,
                    "updatedAt": now
                }
            }
        )
        
        # Update correction request
        await db.correction_requests.update_one(
            {"id": request_id},
            {
                "$set": {
                    "status": "APPROVED",
                    "reviewedBy": current_admin["username"],
                    "reviewedAt": now,
                    "reviewNotes": review.reviewNotes
                }
            }
        )
        
        # Create audit log
        audit_log = AuditLog(
            action="CORRECTION_APPROVED",
            performedBy=current_admin["username"],
            targetId=request_id,
            beforeValues={
                "timeIn": attendance["timeIn"],
                "timeOut": attendance.get("timeOut"),
                "totalHours": attendance.get("totalHours")
            },
            afterValues={
                "timeIn": correction["requestedTimeIn"],
                "timeOut": correction["requestedTimeOut"],
                "totalHours": total_hours
            },
            reason=correction["reason"]
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        return {"message": "Correction request approved", "status": "APPROVED"}
    
    elif review.action.lower() == "reject":
        # Update correction request
        await db.correction_requests.update_one(
            {"id": request_id},
            {
                "$set": {
                    "status": "REJECTED",
                    "reviewedBy": current_admin["username"],
                    "reviewedAt": now,
                    "reviewNotes": review.reviewNotes
                }
            }
        )
        
        # Create audit log
        audit_log = AuditLog(
            action="CORRECTION_REJECTED",
            performedBy=current_admin["username"],
            targetId=request_id,
            reason=review.reviewNotes or "Request rejected"
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        return {"message": "Correction request rejected", "status": "REJECTED"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'")

@api_router.get("/audit-logs", response_model=List[AuditLog])
async def get_audit_logs(
    targetId: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    current_admin: dict = Depends(get_current_admin)
):
    # Only admins can view audit logs
    if current_admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view audit logs")
    
    query = {}
    if targetId:
        query["targetId"] = targetId
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    return [AuditLog(**log) for log in logs]




# ============================================================================
# PAYROLL CALCULATION WITH SSS DEDUCTION
# ============================================================================

@api_router.get("/payroll/calculate")
async def calculate_payroll(
    employeeId: str,
    startDate: str,
    endDate: str,
    current_admin: dict = Depends(get_current_admin)
):
    """
    Calculate payroll for an employee including SSS deduction
    """
    # Get employee
    employee = await db.employees.find_one({"id": employeeId})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get attendance records for the period
    records = await db.attendance.find({
        "employeeId": employeeId,
        "date": {"$gte": startDate, "$lte": endDate},
        "status": "COMPLETE"
    }).to_list(1000)
    
    # Calculate hours and gross pay
    total_regular_hours = sum(r.get("regularHours", 0) for r in records)
    total_overtime_hours = sum(r.get("overtimeHours", 0) for r in records)
    hourly_rate = employee["payRate"]
    overtime_rate = hourly_rate * 1.25  # 25% premium for overtime
    
    regular_pay = total_regular_hours * hourly_rate
    overtime_pay = total_overtime_hours * overtime_rate
    gross_pay = regular_pay + overtime_pay
    
    # Calculate monthly salary for SSS (assuming 4 weeks)
    hours_per_day = 8
    days_per_month = 26  # Standard working days
    monthly_hours = hours_per_day * days_per_month
    estimated_monthly_salary = hourly_rate * monthly_hours
    
    # Calculate SSS contribution
    sss_data = calculate_sss_contribution(estimated_monthly_salary)
    
    # Calculate net pay
    net_pay = gross_pay - sss_data["employee_share"]
    
    return {
        "employeeId": employeeId,
        "employeeName": employee["fullName"],
        "period": {"start": startDate, "end": endDate},
        "hours": {
            "regular": total_regular_hours,
            "overtime": total_overtime_hours,
            "total": total_regular_hours + total_overtime_hours
        },
        "rates": {
            "hourly": hourly_rate,
            "overtime": overtime_rate
        },
        "pay": {
            "regular": round(regular_pay, 2),
            "overtime": round(overtime_pay, 2),
            "gross": round(gross_pay, 2)
        },
        "deductions": {
            "sss_employee": sss_data["employee_share"],
            "sss_employer": sss_data["employer_share"],
            "total_deductions": sss_data["employee_share"]
        },
        "net_pay": round(net_pay, 2),
        "days_worked": len(records)
    }


# MIGRATION ENDPOINT - Import data from localStorage
# ============================================================================

class MigrationData(BaseModel):
    employees: List[dict]
    attendance: List[dict]

@api_router.post("/migrate")
async def migrate_data(
    data: MigrationData,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        # Migrate employees - need to convert role names to roleIds
        role_map = {}
        
        # Extract unique role names from employees
        unique_roles = set()
        for emp in data.employees:
            if "role" in emp:
                unique_roles.add(emp["role"])
        
        # Create roles if they don't exist
        for role_name in unique_roles:
            existing_role = await db.roles.find_one({"name": {"$regex": f"^{role_name}$", "$options": "i"}})
            if existing_role:
                role_map[role_name] = existing_role["id"]
            else:
                new_role = Role(name=role_name)
                await db.roles.insert_one(new_role.dict())
                role_map[role_name] = new_role.id
        
        # Migrate employees
        for emp in data.employees:
            role_id = role_map.get(emp.get("role", ""), None)
            if not role_id:
                continue
            
            # Check if employee already exists
            existing = await db.employees.find_one({"id": emp["id"]})
            if not existing:
                employee = Employee(
                    id=emp["id"],
                    fullName=emp["fullName"],
                    email=emp["email"],
                    phone=emp["phone"],
                    address=emp["address"],
                    status=emp["status"],
                    roleId=role_id,
                    payType="Hourly",
                    payRate=emp.get("payRate", 0),
                    dateHired=emp["dateHired"]
                )
                await db.employees.insert_one(employee.dict())
        
        # Migrate attendance records
        for att in data.attendance:
            existing = await db.attendance.find_one({"id": att["id"]})
            if not existing:
                record = AttendanceRecord(**att)
                await db.attendance.insert_one(record.dict())
        
        return {"message": "Migration completed successfully"}
    except Exception as e:
        logger.error(f"Migration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
