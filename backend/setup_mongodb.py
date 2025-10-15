"""
MongoDB Database Initialization Script for IntelliBase

This script:
1. Connects to MongoDB Atlas
2. Checks if the database and collections exist
3. Creates the database schema if needed
4. Sets up indexes for optimal performance
5. Validates the setup
"""
import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, CollectionInvalid

# MongoDB connection details
MONGODB_URI = os.environ.get("MONGODB_URI")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "intellibase")


def get_mongo_client():
    """Create and return MongoDB client"""
    if not MONGODB_URI:
        raise ValueError("MONGODB_URI not set in environment variables")
    
    # Replace <db_password> placeholder if needed
    if "<db_password>" in MONGODB_URI:
        print("⚠️  Warning: MongoDB URI contains <db_password> placeholder.")
        print("   Please replace it with your actual password in the .env file")
        return None
    
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        print("✅ Successfully connected to MongoDB Atlas")
        return client
    except ConnectionFailure as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None


def check_database_exists(client, db_name):
    """Check if database already exists"""
    existing_dbs = client.list_database_names()
    exists = db_name in existing_dbs
    if exists:
        print(f"✅ Database '{db_name}' already exists")
    else:
        print(f"📝 Database '{db_name}' does not exist - will be created")
    return exists


def check_collection_exists(db, collection_name):
    """Check if a collection exists in the database"""
    existing_collections = db.list_collection_names()
    exists = collection_name in existing_collections
    if exists:
        print(f"   ✅ Collection '{collection_name}' exists")
    else:
        print(f"   📝 Collection '{collection_name}' needs to be created")
    return exists


def create_users_collection(db):
    """Create users collection with schema validation and indexes"""
    print("\n🔧 Setting up 'users' collection...")
    
    # Create collection with schema validation
    try:
        db.create_collection(
            "users",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["username", "email", "password_hash", "pinecone_namespace", "created_at"],
                    "properties": {
                        "username": {
                            "bsonType": "string",
                            "description": "Unique username for login"
                        },
                        "email": {
                            "bsonType": "string",
                            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                            "description": "User email address"
                        },
                        "password_hash": {
                            "bsonType": "string",
                            "description": "Bcrypt hashed password"
                        },
                        "pinecone_namespace": {
                            "bsonType": "string",
                            "description": "Unique Pinecone namespace for user's vectors"
                        },
                        "created_at": {
                            "bsonType": "date",
                            "description": "Account creation timestamp"
                        },
                        "last_login": {
                            "bsonType": "date",
                            "description": "Last login timestamp"
                        }
                    }
                }
            }
        )
        print("   ✅ Collection 'users' created with schema validation")
    except CollectionInvalid:
        print("   ℹ️  Collection 'users' already exists")
    
    # Create indexes
    users = db.users
    users.create_index([("username", ASCENDING)], unique=True)
    users.create_index([("email", ASCENDING)], unique=True)
    users.create_index([("pinecone_namespace", ASCENDING)], unique=True)
    users.create_index([("created_at", DESCENDING)])
    print("   ✅ Indexes created: username, email, pinecone_namespace (unique), created_at")


def create_documents_collection(db):
    """Create documents collection with schema validation and indexes"""
    print("\n🔧 Setting up 'documents' collection...")
    
    try:
        db.create_collection(
            "documents",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["user_id", "filename", "upload_date", "processing_status"],
                    "properties": {
                        "user_id": {
                            "bsonType": "objectId",
                            "description": "Reference to users collection"
                        },
                        "filename": {
                            "bsonType": "string",
                            "description": "Original filename"
                        },
                        "upload_date": {
                            "bsonType": "date",
                            "description": "Upload timestamp"
                        },
                        "size_bytes": {
                            "bsonType": "long",
                            "description": "File size in bytes"
                        },
                        "chunk_count": {
                            "bsonType": "int",
                            "description": "Number of chunks created"
                        },
                        "processing_status": {
                            "enum": ["pending", "processing", "completed", "failed"],
                            "description": "Document processing status"
                        },
                        "pinecone_namespace": {
                            "bsonType": "string",
                            "description": "Pinecone namespace where vectors are stored"
                        }
                    }
                }
            }
        )
        print("   ✅ Collection 'documents' created with schema validation")
    except CollectionInvalid:
        print("   ℹ️  Collection 'documents' already exists")
    
    # Create indexes
    documents = db.documents
    documents.create_index([("user_id", ASCENDING), ("upload_date", DESCENDING)])
    documents.create_index([("processing_status", ASCENDING)])
    print("   ✅ Indexes created: user_id + upload_date, processing_status")


def create_chat_sessions_collection(db):
    """Create chat_sessions collection with schema validation, indexes, and TTL"""
    print("\n🔧 Setting up 'chat_sessions' collection...")
    
    try:
        db.create_collection(
            "chat_sessions",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["user_id", "session_id", "created_at", "expires_at"],
                    "properties": {
                        "user_id": {
                            "bsonType": "objectId",
                            "description": "Reference to users collection"
                        },
                        "session_id": {
                            "bsonType": "string",
                            "description": "Human-readable session identifier"
                        },
                        "created_at": {
                            "bsonType": "date",
                            "description": "Session creation timestamp"
                        },
                        "expires_at": {
                            "bsonType": "date",
                            "description": "Expiration timestamp (30 days from creation)"
                        },
                        "messages": {
                            "bsonType": "array",
                            "description": "Chat messages in this session",
                            "items": {
                                "bsonType": "object",
                                "required": ["role", "content", "timestamp"],
                                "properties": {
                                    "role": {
                                        "enum": ["user", "assistant"],
                                        "description": "Message sender"
                                    },
                                    "content": {
                                        "bsonType": "string",
                                        "description": "Message content"
                                    },
                                    "timestamp": {
                                        "bsonType": "date",
                                        "description": "Message timestamp"
                                    },
                                    "citations": {
                                        "bsonType": "array",
                                        "description": "Source citations for assistant messages"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        )
        print("   ✅ Collection 'chat_sessions' created with schema validation")
    except CollectionInvalid:
        print("   ℹ️  Collection 'chat_sessions' already exists")
    
    # Create indexes
    chat_sessions = db.chat_sessions
    chat_sessions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    chat_sessions.create_index([("session_id", ASCENDING)], unique=True)
    
    # TTL index for auto-deletion after 30 days
    chat_sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
    print("   ✅ Indexes created: user_id + created_at, session_id (unique)")
    print("   ✅ TTL index created: auto-delete after expires_at (30 days)")


def validate_setup(db):
    """Validate that all collections and indexes are properly set up"""
    print("\n🔍 Validating database setup...")
    
    required_collections = ["users", "documents", "chat_sessions"]
    existing_collections = db.list_collection_names()
    
    all_exist = all(col in existing_collections for col in required_collections)
    
    if all_exist:
        print("✅ All required collections exist:")
        for col in required_collections:
            indexes = list(db[col].list_indexes())
            print(f"   - {col}: {len(indexes)} indexes")
        return True
    else:
        missing = [col for col in required_collections if col not in existing_collections]
        print(f"❌ Missing collections: {missing}")
        return False


def insert_sample_data(db):
    """Insert sample data for testing (optional)"""
    print("\n📝 Would you like to insert sample test data? (y/n): ", end="")
    response = input().strip().lower()
    
    if response != 'y':
        print("   Skipping sample data insertion")
        return
    
    print("\n📝 Inserting sample data...")
    
    # Sample user
    from bson import ObjectId
    user_id = ObjectId()
    
    sample_user = {
        "_id": user_id,
        "username": "demo_user",
        "email": "demo@intellibase.com",
        "password_hash": "$2b$12$samplehashhere",  # Not a real hash
        "pinecone_namespace": f"user_{str(user_id)}",
        "created_at": datetime.utcnow(),
        "last_login": datetime.utcnow()
    }
    
    try:
        db.users.insert_one(sample_user)
        print("   ✅ Sample user created: demo_user")
    except Exception as e:
        print(f"   ℹ️  Sample user already exists or error: {e}")


def main():
    """Main initialization function"""
    print("="*80)
    print("🚀 IntelliBase - MongoDB Database Initialization")
    print("="*80)
    
    # Step 1: Connect to MongoDB
    print("\n1️⃣  Connecting to MongoDB Atlas...")
    client = get_mongo_client()
    
    if not client:
        print("\n❌ Cannot proceed without database connection")
        print("   Please check your MONGODB_URI in .env file")
        sys.exit(1)
    
    # Step 2: Select/Create database
    print(f"\n2️⃣  Setting up database '{MONGODB_DB_NAME}'...")
    db_exists = check_database_exists(client, MONGODB_DB_NAME)
    db = client[MONGODB_DB_NAME]
    
    # Step 3: Check existing collections
    print("\n3️⃣  Checking collections...")
    users_exist = check_collection_exists(db, "users")
    docs_exist = check_collection_exists(db, "documents")
    sessions_exist = check_collection_exists(db, "chat_sessions")
    
    # Step 4: Create missing collections
    if not users_exist:
        create_users_collection(db)
    else:
        print("   ℹ️  Skipping 'users' - already configured")
    
    if not docs_exist:
        create_documents_collection(db)
    else:
        print("   ℹ️  Skipping 'documents' - already configured")
    
    if not sessions_exist:
        create_chat_sessions_collection(db)
    else:
        print("   ℹ️  Skipping 'chat_sessions' - already configured")
    
    # Step 5: Validate setup
    if validate_setup(db):
        print("\n✅ Database setup completed successfully!")
    else:
        print("\n⚠️  Database setup incomplete - please review errors above")
        sys.exit(1)
    
    # Step 6: Optional sample data
    insert_sample_data(db)
    
    # Summary
    print("\n" + "="*80)
    print("📊 SETUP SUMMARY")
    print("="*80)
    print(f"Database: {MONGODB_DB_NAME}")
    print(f"Collections: users, documents, chat_sessions")
    print(f"Status: Ready for production use")
    print("\n🎯 Next Steps:")
    print("   1. Update your .env file with the MongoDB password")
    print("   2. Run the FastAPI application: uvicorn app:app --reload")
    print("   3. Test signup/login endpoints")
    print("="*80)
    
    client.close()


if __name__ == "__main__":
    main()
