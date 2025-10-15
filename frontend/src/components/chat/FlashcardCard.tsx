import { useState } from 'react';

interface FlashcardCardProps {
  question: string;
  answer: string;
}

const FlashcardCard = ({ question, answer }: FlashcardCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div 
      className="flashcard-container"
      onClick={handleClick}
      style={{ perspective: '1000px', cursor: 'pointer' }}
    >
      <div 
        className={`flashcard ${isFlipped ? 'flipped' : ''}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '250px',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front Side - Question */}
        <div 
          className="flashcard-front"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            backgroundColor: '#1e1e1e',
            border: '2px solid #3b82f6',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: '#3b82f6',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Question
          </div>
          <div style={{ 
            fontSize: '16px', 
            textAlign: 'center',
            color: '#e5e7eb',
            lineHeight: '1.6'
          }}>
            {question}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#9ca3af',
            marginTop: '16px',
            fontStyle: 'italic'
          }}>
            Click to reveal answer
          </div>
        </div>

        {/* Back Side - Answer */}
        <div 
          className="flashcard-back"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            backgroundColor: '#1e1e1e',
            border: '2px solid #10b981',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transform: 'rotateY(180deg)',
          }}
        >
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: '#10b981',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Answer
          </div>
          <div style={{ 
            fontSize: '16px', 
            textAlign: 'center',
            color: '#e5e7eb',
            lineHeight: '1.6'
          }}>
            {answer}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#9ca3af',
            marginTop: '16px',
            fontStyle: 'italic'
          }}>
            Click to see question
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardCard;
