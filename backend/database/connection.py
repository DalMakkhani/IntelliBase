"""
MongoDB connection management
"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.environ.get("MONGODB_URI")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "intellibase")

# Global MongoDB client
_client = None
_db = None


def get_database():
    """
    Get MongoDB database instance (singleton pattern)
    
    Returns:
        MongoDB database object
    """
    global _client, _db
    
    if _db is None:
        if not MONGODB_URI:
            raise ValueError("MONGODB_URI not set in environment variables")
        
        _client = MongoClient(MONGODB_URI)
        _db = _client[MONGODB_DB_NAME]
    
    return _db


def close_database():
    """Close MongoDB connection"""
    global _client
    if _client:
        _client.close()


# Convenience functions to get collections
def get_users_collection():
    """Get users collection"""
    db = get_database()
    return db.users


def get_documents_collection():
    """Get documents collection"""
    db = get_database()
    return db.documents


def get_chat_sessions_collection():
    """Get chat_sessions collection"""
    db = get_database()
    return db.chat_sessions
