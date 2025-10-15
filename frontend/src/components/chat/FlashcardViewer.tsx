import { useEffect, useState } from 'react';
import FlashcardCard from './FlashcardCard';
import { API_BASE_URL } from '@/lib/api';

interface Flashcard {
  question: string;
  answer: string;
}

interface FlashcardSet {
  set_id: string;
  user_id: string;
  session_id: string;
  topic: string;
  flashcards: Flashcard[];
  created_at: string;
  last_reviewed: string | null;
}

interface FlashcardViewerProps {
  sessionId: string;
}

const FlashcardViewer = ({ sessionId }: FlashcardViewerProps) => {
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlashcards = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setError('Please log in to view flashcards');
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/flashcards/session/${sessionId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch flashcards');
        }

        const data = await response.json();
        setFlashcardSets(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching flashcards:', err);
        setError('Failed to load flashcards');
        setLoading(false);
      }
    };

    fetchFlashcards();
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#9ca3af'
      }}>
        Loading flashcards...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#ef4444'
      }}>
        {error}
      </div>
    );
  }

  if (flashcardSets.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      {flashcardSets.map((set) => (
        <div key={set.set_id} style={{ marginBottom: '30px' }}>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: '#e5e7eb',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '2px solid #374151'
          }}>
            📚 {set.topic}
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}>
            {set.flashcards.map((flashcard, index) => (
              <FlashcardCard
                key={index}
                question={flashcard.question}
                answer={flashcard.answer}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FlashcardViewer;
