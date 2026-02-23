import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

async def ensure_admin():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    # Always ensure admin exists with correct password
    admin = await db.admins.find_one({"username": "admin"})
    
    if not admin:
        print("Creating admin user...")
        await db.admins.insert_one({
            "id": "admin-001",
            "username": "admin",
            "password": pwd_context.hash("admin123"),
            "forcePasswordChange": True
        })
        print("✅ Admin created")
    else:
        # Reset password if needed
        await db.admins.update_one(
            {"username": "admin"},
            {"$set": {"password": pwd_context.hash("admin123")}}
        )
        print("✅ Admin password ensured")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(ensure_admin())
