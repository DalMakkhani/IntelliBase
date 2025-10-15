"""Flashcard models for study mode"""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Flashcard(BaseModel):
    question: str
    answer: str
    

class FlashcardSet(BaseModel):
    set_id: str
    user_id: str
    session_id: str
    topic: str
    flashcards: List[Flashcard]
    created_at: datetime
    last_reviewed: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "set_id": "fc_abc123",
                "user_id": "user_123",
                "session_id": "sess_xyz",
                "topic": "Machine Learning Basics",
                "flashcards": [
                    {
                        "question": "What is supervised learning?",
                        "answer": "A type of machine learning where the model learns from labeled training data."
                    }
                ],
                "created_at": "2025-10-15T10:30:00",
                "last_reviewed": None
            }
        }


class CreateFlashcardSetRequest(BaseModel):
    session_id: str
    topic: str
    flashcards: List[Flashcard]


class GetFlashcardSetsResponse(BaseModel):
    flashcard_sets: List[FlashcardSet]
