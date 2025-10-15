"""Flashcard routes for study mode"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from bson import ObjectId
import uuid

from routes.auth import get_current_user
from database.connection import get_database
from models.flashcard import CreateFlashcardSetRequest, FlashcardSet, GetFlashcardSetsResponse

router = APIRouter(prefix="/flashcards", tags=["Flashcards"])


def get_flashcards_collection():
    """Get flashcards collection from database"""
    db = get_database()
    return db["flashcard_sets"]


@router.post("/create", response_model=FlashcardSet)
async def create_flashcard_set(
    request: CreateFlashcardSetRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new flashcard set"""
    try:
        user_id = current_user["user_id"]
        flashcards_collection = get_flashcards_collection()
        
        set_id = f"fc_{uuid.uuid4().hex[:12]}"
        
        flashcard_set = {
            "_id": ObjectId(),
            "set_id": set_id,
            "user_id": ObjectId(user_id),
            "session_id": request.session_id,
            "topic": request.topic,
            "flashcards": [fc.dict() for fc in request.flashcards],
            "created_at": datetime.utcnow(),
            "last_reviewed": None
        }
        
        flashcards_collection.insert_one(flashcard_set)
        
        # Convert ObjectId to string for response
        flashcard_set["user_id"] = user_id
        flashcard_set.pop("_id")
        
        return FlashcardSet(**flashcard_set)
        
    except Exception as e:
        print(f"❌ Error creating flashcard set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}", response_model=GetFlashcardSetsResponse)
async def get_flashcards_by_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all flashcard sets for a session"""
    try:
        user_id = current_user["user_id"]
        flashcards_collection = get_flashcards_collection()
        
        sets = list(flashcards_collection.find({
            "user_id": ObjectId(user_id),
            "session_id": session_id
        }).sort("created_at", -1))
        
        # Convert to response format
        flashcard_sets = []
        for s in sets:
            s["user_id"] = str(s["user_id"])
            s.pop("_id")
            flashcard_sets.append(FlashcardSet(**s))
        
        return GetFlashcardSetsResponse(flashcard_sets=flashcard_sets)
        
    except Exception as e:
        print(f"❌ Error fetching flashcards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all", response_model=GetFlashcardSetsResponse)
async def get_all_flashcards(current_user: dict = Depends(get_current_user)):
    """Get all flashcard sets for the current user"""
    try:
        user_id = current_user["user_id"]
        flashcards_collection = get_flashcards_collection()
        
        sets = list(flashcards_collection.find({
            "user_id": ObjectId(user_id)
        }).sort("created_at", -1))
        
        # Convert to response format
        flashcard_sets = []
        for s in sets:
            s["user_id"] = str(s["user_id"])
            s.pop("_id")
            flashcard_sets.append(FlashcardSet(**s))
        
        return GetFlashcardSetsResponse(flashcard_sets=flashcard_sets)
        
    except Exception as e:
        print(f"❌ Error fetching flashcards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{set_id}/review")
async def mark_reviewed(
    set_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a flashcard set as reviewed"""
    try:
        user_id = current_user["user_id"]
        flashcards_collection = get_flashcards_collection()
        
        result = flashcards_collection.update_one(
            {"set_id": set_id, "user_id": ObjectId(user_id)},
            {"$set": {"last_reviewed": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Flashcard set not found")
        
        return {"message": "Flashcard set marked as reviewed"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{set_id}")
async def delete_flashcard_set(
    set_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a flashcard set"""
    try:
        user_id = current_user["user_id"]
        flashcards_collection = get_flashcards_collection()
        
        result = flashcards_collection.delete_one({
            "set_id": set_id,
            "user_id": ObjectId(user_id)
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Flashcard set not found")
        
        return {"message": "Flashcard set deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))
