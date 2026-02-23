#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Pastry Pal
Tests all authentication, role management, employee management, and attendance APIs
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://pastry-admin-secure.preview.emergentagent.com/api"
TIMEOUT = 30

# Global variables to store test data
auth_token = ""
test_data = {
    "roles": [],
    "employees": [],
    "attendance": []
}

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def success(self, message: str):
        print(f"✅ {message}")
        self.passed += 1
    
    def failure(self, message: str, detail: str = ""):
        error_msg = f"❌ {message}"
        if detail:
            error_msg += f" - {detail}"
        print(error_msg)
        self.errors.append(error_msg)
        self.failed += 1
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} passed, {self.failed} failed")
        if self.errors:
            print("\nFAILED TESTS:")
            for error in self.errors:
                print(f"  {error}")
        print(f"{'='*60}")
        return self.failed == 0

result = TestResult()

def make_request(method: str, endpoint: str, data: Dict[Any, Any] = None, 
                params: Dict[str, Any] = None, use_auth: bool = False) -> requests.Response:
    """Make HTTP request with optional authentication"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if use_auth and auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=TIMEOUT)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=TIMEOUT)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=TIMEOUT)
        elif method.upper() == "PATCH":
            response = requests.patch(url, headers=headers, json=data, timeout=TIMEOUT)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, timeout=TIMEOUT)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        print(f"{method.upper()} {endpoint} -> {response.status_code}")
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {method.upper()} {endpoint} - {str(e)}")
        raise

def test_authentication_flow():
    """Test complete authentication flow"""
    global auth_token
    
    print("\n🔐 TESTING AUTHENTICATION FLOW")
    print("-" * 40)
    
    # Step 1: Login with default credentials
    print("\n1. Testing login with default credentials")
    try:
        response = make_request("POST", "/auth/login", {
            "username": "admin",
            "password": "admin123"
        })
        
        if response.status_code == 200:
            data = response.json()
            if all(key in data for key in ["token", "username", "forcePasswordChange"]):
                auth_token = data["token"]
                if data["forcePasswordChange"] is True:
                    result.success(f"Login successful - forcePasswordChange: {data['forcePasswordChange']}")
                else:
                    result.failure("Login successful but forcePasswordChange should be True", 
                                 f"Got: {data['forcePasswordChange']}")
            else:
                result.failure("Login response missing required fields", 
                             f"Expected: token, username, forcePasswordChange. Got: {list(data.keys())}")
        else:
            result.failure(f"Login failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Login request failed", str(e))
    
    # Step 2: Change password
    print("\n2. Testing password change")
    try:
        response = make_request("POST", "/auth/change-password", {
            "currentPassword": "admin123",
            "newPassword": "NewAdmin456"
        }, use_auth=True)
        
        if response.status_code == 200:
            result.success("Password changed successfully")
        else:
            result.failure(f"Password change failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Password change request failed", str(e))
    
    # Step 3: Login with new credentials
    print("\n3. Testing login with new credentials")
    try:
        response = make_request("POST", "/auth/login", {
            "username": "admin",
            "password": "NewAdmin456"
        })
        
        if response.status_code == 200:
            data = response.json()
            auth_token = data["token"]  # Update token
            if data["forcePasswordChange"] is False:
                result.success(f"Login with new password successful - forcePasswordChange: {data['forcePasswordChange']}")
            else:
                result.failure("Login successful but forcePasswordChange should now be False", 
                             f"Got: {data['forcePasswordChange']}")
        else:
            result.failure(f"Login with new password failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Login with new password request failed", str(e))
    
    # Step 4: Test /auth/me endpoint
    print("\n4. Testing /auth/me endpoint")
    try:
        response = make_request("GET", "/auth/me", use_auth=True)
        
        if response.status_code == 200:
            data = response.json()
            if "username" in data and data["username"] == "admin":
                result.success(f"Auth verification successful - username: {data['username']}")
            else:
                result.failure("Auth verification failed", f"Expected username 'admin', got: {data}")
        else:
            result.failure(f"Auth verification failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Auth verification request failed", str(e))

def test_role_management():
    """Test role management CRUD operations"""
    print("\n👤 TESTING ROLE MANAGEMENT")
    print("-" * 40)
    
    # Step 1: Create "Baker" role
    print("\n1. Creating 'Baker' role")
    try:
        response = make_request("POST", "/roles", {
            "name": "Baker"
        }, use_auth=True)
        
        if response.status_code == 200:
            data = response.json()
            if data["name"] == "Baker" and "id" in data:
                test_data["roles"].append(data)
                result.success(f"Baker role created with ID: {data['id']}")
            else:
                result.failure("Baker role creation failed", f"Unexpected response: {data}")
        else:
            result.failure(f"Baker role creation failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Baker role creation request failed", str(e))
    
    # Step 2: Create "Cashier" role
    print("\n2. Creating 'Cashier' role")
    try:
        response = make_request("POST", "/roles", {
            "name": "Cashier"
        }, use_auth=True)
        
        if response.status_code == 200:
            data = response.json()
            if data["name"] == "Cashier" and "id" in data:
                test_data["roles"].append(data)
                result.success(f"Cashier role created with ID: {data['id']}")
            else:
                result.failure("Cashier role creation failed", f"Unexpected response: {data}")
        else:
            result.failure(f"Cashier role creation failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Cashier role creation request failed", str(e))
    
    # Step 3: Create "Manager" role
    print("\n3. Creating 'Manager' role")
    try:
        response = make_request("POST", "/roles", {
            "name": "Manager"
        }, use_auth=True)
        
        if response.status_code == 200:
            data = response.json()
            if data["name"] == "Manager" and "id" in data:
                test_data["roles"].append(data)
                result.success(f"Manager role created with ID: {data['id']}")
            else:
                result.failure("Manager role creation failed", f"Unexpected response: {data}")
        else:
            result.failure(f"Manager role creation failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Manager role creation request failed", str(e))
    
    # Step 4: Try creating duplicate "baker" (should fail)
    print("\n4. Testing duplicate role creation (should fail)")
    try:
        response = make_request("POST", "/roles", {
            "name": "baker"  # Different case
        }, use_auth=True)
        
        if response.status_code == 400:
            result.success("Duplicate role creation correctly rejected")
        else:
            result.failure(f"Duplicate role should have been rejected with 400, got {response.status_code}", 
                         response.text)
    except Exception as e:
        result.failure("Duplicate role creation test failed", str(e))
    
    # Step 5: Update Baker role to "Head Baker"
    if test_data["roles"]:
        baker_role = next((r for r in test_data["roles"] if r["name"] == "Baker"), None)
        if baker_role:
            print("\n5. Updating Baker role to 'Head Baker'")
            try:
                response = make_request("PUT", f"/roles/{baker_role['id']}", {
                    "name": "Head Baker"
                }, use_auth=True)
                
                if response.status_code == 200:
                    data = response.json()
                    if data["name"] == "Head Baker":
                        # Update our test data
                        baker_role["name"] = "Head Baker"
                        result.success("Baker role updated to 'Head Baker'")
                    else:
                        result.failure("Role update failed", f"Expected 'Head Baker', got: {data['name']}")
                else:
                    result.failure(f"Role update failed with status {response.status_code}", response.text)
            except Exception as e:
                result.failure("Role update request failed", str(e))
    
    # Step 6: Toggle Cashier role to inactive
    if test_data["roles"]:
        cashier_role = next((r for r in test_data["roles"] if r["name"] == "Cashier"), None)
        if cashier_role:
            print("\n6. Deactivating Cashier role")
            try:
                response = make_request("PATCH", f"/roles/{cashier_role['id']}/toggle", use_auth=True)
                
                if response.status_code == 200:
                    result.success("Cashier role deactivated")
                    cashier_role["isActive"] = False
                else:
                    result.failure(f"Role deactivation failed with status {response.status_code}", response.text)
            except Exception as e:
                result.failure("Role deactivation request failed", str(e))
    
    # Step 7: Test activeOnly parameter
    print("\n7. Testing GET /roles with activeOnly=true")
    try:
        response = make_request("GET", "/roles", params={"activeOnly": "true"}, use_auth=True)
        
        if response.status_code == 200:
            roles = response.json()
            cashier_in_results = any(role["name"] == "Cashier" for role in roles)
            if not cashier_in_results:
                result.success("GET /roles?activeOnly=true correctly excludes inactive Cashier")
            else:
                result.failure("GET /roles?activeOnly=true should not include inactive Cashier", 
                             f"Found roles: {[r['name'] for r in roles]}")
        else:
            result.failure(f"GET roles failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("GET roles request failed", str(e))

def test_employee_management():
    """Test employee management operations"""
    print("\n👥 TESTING EMPLOYEE MANAGEMENT")
    print("-" * 40)
    
    # Step 1: Create employee with Baker roleId
    active_roles = [r for r in test_data["roles"] if r.get("isActive", True)]
    if active_roles:
        baker_role = next((r for r in active_roles if "Baker" in r["name"]), active_roles[0])
        
        print(f"\n1. Creating employee with role: {baker_role['name']}")
        try:
            response = make_request("POST", "/employees", {
                "fullName": "Sarah Johnson",
                "email": "sarah.johnson@pastrypal.com",
                "phone": "(555) 123-4567",
                "address": "123 Main St, Bakery Town, ST 12345",
                "status": "Active",
                "roleId": baker_role["id"],
                "payRate": 18.50,
                "dateHired": "2024-01-15"
            }, use_auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if data["payType"] == "Hourly" and data["roleId"] == baker_role["id"]:
                    test_data["employees"].append(data)
                    result.success(f"Employee created with payType: {data['payType']}, ID: {data['id']}")
                else:
                    result.failure("Employee creation failed validation", 
                                 f"Expected payType='Hourly', roleId='{baker_role['id']}', got payType='{data['payType']}', roleId='{data['roleId']}'")
            else:
                result.failure(f"Employee creation failed with status {response.status_code}", response.text)
        except Exception as e:
            result.failure("Employee creation request failed", str(e))
    else:
        result.failure("No active roles available for employee creation", "")
    
    # Step 2: Get all employees
    print("\n2. Fetching all employees")
    try:
        response = make_request("GET", "/employees", use_auth=True)
        
        if response.status_code == 200:
            employees = response.json()
            result.success(f"Retrieved {len(employees)} employees")
        else:
            result.failure(f"GET employees failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("GET employees request failed", str(e))
    
    # Step 3: Update employee
    if test_data["employees"]:
        employee = test_data["employees"][0]
        print(f"\n3. Updating employee {employee['id']}")
        try:
            response = make_request("PUT", f"/employees/{employee['id']}", {
                "fullName": "Sarah Johnson-Baker",
                "email": employee["email"],
                "phone": employee["phone"],
                "address": employee["address"],
                "status": employee["status"],
                "roleId": employee["roleId"],
                "payRate": 20.00,
                "dateHired": employee["dateHired"]
            }, use_auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if data["fullName"] == "Sarah Johnson-Baker" and data["payRate"] == 20.00:
                    result.success("Employee updated successfully")
                else:
                    result.failure("Employee update failed", f"Name or payRate not updated correctly")
            else:
                result.failure(f"Employee update failed with status {response.status_code}", response.text)
        except Exception as e:
            result.failure("Employee update request failed", str(e))
    
    # Step 4: Try to delete Baker role (should fail - in use)
    baker_role = next((r for r in test_data["roles"] if "Baker" in r["name"]), None)
    if baker_role and test_data["employees"]:
        print(f"\n4. Attempting to delete {baker_role['name']} role (should fail - in use)")
        try:
            response = make_request("DELETE", f"/roles/{baker_role['id']}", use_auth=True)
            
            if response.status_code == 400:
                result.success("Role deletion correctly rejected - role is in use")
            else:
                result.failure(f"Role deletion should have been rejected with 400, got {response.status_code}", 
                             response.text)
        except Exception as e:
            result.failure("Role deletion test failed", str(e))

def test_attendance_management():
    """Test attendance management operations"""
    print("\n⏰ TESTING ATTENDANCE MANAGEMENT")
    print("-" * 40)
    
    if not test_data["employees"]:
        result.failure("No employees available for attendance testing", "")
        return
    
    employee = test_data["employees"][0]
    
    # Step 1: Clock in employee
    print(f"\n1. Clocking in employee {employee['id']}")
    try:
        response = make_request("POST", "/attendance/clock-in", {
            "employeeId": employee["id"],
            "notes": "Starting morning shift"
        }, use_auth=True)
        
        if response.status_code == 200:
            data = response.json()
            if data["employeeId"] == employee["id"] and data["timeOut"] is None:
                test_data["attendance"].append(data)
                result.success(f"Employee clocked in - Record ID: {data['id']}")
            else:
                result.failure("Clock-in response invalid", f"Expected employeeId='{employee['id']}', timeOut=None")
        else:
            result.failure(f"Clock-in failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Clock-in request failed", str(e))
    
    # Step 2: Get clocked-in employees
    print("\n2. Fetching clocked-in employees")
    try:
        response = make_request("GET", "/attendance/clocked-in", use_auth=True)
        
        if response.status_code == 200:
            data = response.json()
            if employee["id"] in data.get("employeeIds", []):
                result.success(f"Employee {employee['id']} found in clocked-in list")
            else:
                result.failure("Employee not found in clocked-in list", 
                             f"Expected {employee['id']} in {data.get('employeeIds', [])}")
        else:
            result.failure(f"Get clocked-in failed with status {response.status_code}", response.text)
    except Exception as e:
        result.failure("Get clocked-in request failed", str(e))
    
    # Wait a moment to ensure some time passes for totalHours calculation
    time.sleep(2)
    
    # Step 3: Clock out employee
    if test_data["attendance"]:
        attendance_record = test_data["attendance"][0]
        print(f"\n3. Clocking out employee - Record: {attendance_record['id']}")
        try:
            response = make_request("POST", "/attendance/clock-out", {
                "recordId": attendance_record["id"],
                "notes": "End of morning shift"
            }, use_auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if data["timeOut"] is not None and data["totalHours"] is not None:
                    result.success(f"Employee clocked out - Total hours: {data['totalHours']}")
                else:
                    result.failure("Clock-out response invalid", "timeOut or totalHours missing")
            else:
                result.failure(f"Clock-out failed with status {response.status_code}", response.text)
        except Exception as e:
            result.failure("Clock-out request failed", str(e))

def test_error_cases():
    """Test various error scenarios"""
    print("\n🚨 TESTING ERROR CASES")
    print("-" * 40)
    
    # Step 1: Test with invalid token
    print("\n1. Testing API with invalid token")
    global auth_token
    original_token = auth_token
    auth_token = "invalid-token-12345"
    
    try:
        response = make_request("GET", "/roles", use_auth=True)
        
        if response.status_code == 401:
            result.success("Invalid token correctly rejected with 401")
        else:
            result.failure(f"Invalid token should return 401, got {response.status_code}", response.text)
    except Exception as e:
        result.failure("Invalid token test failed", str(e))
    
    # Restore valid token
    auth_token = original_token
    
    # Step 2: Test missing required fields
    print("\n2. Testing missing required fields in role creation")
    try:
        response = make_request("POST", "/roles", {}, use_auth=True)
        
        if response.status_code == 422:  # Validation error
            result.success("Missing required fields correctly rejected with 422")
        else:
            result.failure(f"Missing fields should return 422, got {response.status_code}", response.text)
    except Exception as e:
        result.failure("Missing fields test failed", str(e))
    
    # Step 3: Test login with wrong credentials
    print("\n3. Testing login with incorrect credentials")
    try:
        response = make_request("POST", "/auth/login", {
            "username": "admin",
            "password": "wrongpassword"
        })
        
        if response.status_code == 401:
            result.success("Incorrect credentials correctly rejected with 401")
        else:
            result.failure(f"Incorrect credentials should return 401, got {response.status_code}", response.text)
    except Exception as e:
        result.failure("Incorrect credentials test failed", str(e))

def main():
    """Run all tests"""
    print("🧪 STARTING COMPREHENSIVE BACKEND API TESTS")
    print("=" * 60)
    print(f"Target URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    try:
        # Test authentication flow
        test_authentication_flow()
        
        # Only proceed if authentication worked
        if auth_token:
            test_role_management()
            test_employee_management()
            test_attendance_management()
        else:
            result.failure("Authentication failed - skipping protected endpoint tests", "")
        
        # Test error cases
        test_error_cases()
        
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {str(e)}")
        result.failure("Unexpected error", str(e))
    
    # Print final summary
    success = result.summary()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
    else:
        print(f"\n⚠️ {result.failed} TESTS FAILED. See details above.")
    
    return success

if __name__ == "__main__":
    main()