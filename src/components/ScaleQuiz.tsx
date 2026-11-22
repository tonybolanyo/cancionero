import React, { useState, useEffect, useCallback } from 'react';
import { Brain, CheckCircle, XCircle, Volume2, SkipForward } from 'lucide-react';
import { getAllScales, getScaleEntry } from '../services/scaleDictionaryService';

interface QuizQuestion {
  id: string;
  type: 'identify' | 'position' | 'interval' | 'shape';
  scale: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface ScaleQuizProps {
  onScaleSelect?: (scaleId: string, position?: number) => void;
}

export const ScaleQuiz: React.FC<ScaleQuizProps> = ({ onScaleSelect }) => {
  const [isStarted, setIsStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [loading, setLoading] = useState(false);

  // Generate quiz questions
  useEffect(() => {
    if (isStarted && questions.length === 0) {
      generateQuestions();
    }
  }, [isStarted]);

  const generateQuestions = useCallback(() => {
    setLoading(true);
    const allScales = getAllScales();
    const generatedQuestions: QuizQuestion[] = [];

    // Generate 10 random questions
    for (let i = 0; i < 10; i++) {
      const randomScale = allScales[Math.floor(Math.random() * allScales.length)];
      const scaleData = getScaleEntry(randomScale);
      
      if (!scaleData) continue;

      // Randomly choose question type
      const questionTypes: Array<'identify' | 'position' | 'interval'> = ['identify', 'position', 'interval'];
      const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

      let question: QuizQuestion | null = null;

      if (questionType === 'identify') {
        // Question type: Identify the scale by description
        const options = [randomScale, ...allScales.slice(0, 3)].sort(() => Math.random() - 0.5);
        question = {
          id: `q-${i}`,
          type: 'identify',
          scale: randomScale,
          difficulty,
          question: `¿Cuál es esta escala? Patrón de intervalos: ${scaleData.intervals.join(', ')}`,
          options,
          correctAnswer: randomScale,
          explanation: scaleData.description
        };
      } else if (questionType === 'position' && scaleData.positions.length > 0) {
        // Question type: Identify the position name
        const position = scaleData.positions[Math.floor(Math.random() * scaleData.positions.length)];
        const positionNames = scaleData.positions.map(p => p.name);
        const wrongNames = ['Posición A', 'Posición B', 'Posición C'].filter(n => !positionNames.includes(n));
        const options = [position.name, ...wrongNames.slice(0, 2)].sort(() => Math.random() - 0.5);
        
        question = {
          id: `q-${i}`,
          type: 'position',
          scale: randomScale,
          difficulty,
          question: `En la escala ${randomScale}, ¿cuál es el nombre de esta posición que comienza en el traste ${position.rootFret}?`,
          options,
          correctAnswer: position.name,
          explanation: `${position.name} es la posición que comienza en el traste ${position.rootFret}`
        };
      } else if (questionType === 'interval') {
        // Question type: Identify intervals
        const intervals = scaleData.intervals;
        const intervalNames = ['Unísono', '2ª menor', '2ª mayor', '3ª menor', '3ª mayor', '4ª justa', 'Tritono', '5ª justa', '6ª menor', '6ª mayor', '7ª menor', '7ª mayor'];
        
        question = {
          id: `q-${i}`,
          type: 'interval',
          scale: randomScale,
          difficulty,
          question: `¿Cuántos intervalos tiene la escala ${randomScale}?`,
          options: ['5', '6', '7', '8'],
          correctAnswer: intervals.length.toString(),
          explanation: `La escala ${randomScale} tiene ${intervals.length} intervalos`
        };
      }

      if (question) {
        generatedQuestions.push(question);
      }
    }

    setQuestions(generatedQuestions);
    setLoading(false);
  }, [difficulty]);

  const currentQuestion = questions[currentQuestionIndex];
  const isCorrect = selectedAnswer === currentQuestion?.correctAnswer;
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const handleAnswer = (answer: string) => {
    if (answered) return;
    
    setSelectedAnswer(answer);
    setAnswered(true);
    
    if (answer === currentQuestion.correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleReset = () => {
    setIsStarted(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnswered(false);
    setSelectedAnswer(null);
    setQuestions([]);
  };

  const handlePlayAudio = () => {
    // Simple sine wave audio synthesis for the scale
    if (currentQuestion.type === 'identify') {
      const scaleData = getScaleEntry(currentQuestion.scale);
      if (scaleData) {
        playScaleAudio(scaleData.intervals);
      }
    }
  };

  if (!isStarted) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-8 border border-purple-200 dark:border-purple-800 max-w-2xl mx-auto">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Brain className="w-12 h-12 text-purple-600 dark:text-purple-400" />
          </div>
          
          <div>
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
              Quiz de Escalas Musicales
            </h2>
            <p className="text-[var(--text-secondary)] mb-4">
              Pon a prueba tus conocimientos sobre escalas, posiciones e intervalos
            </p>
          </div>

          <div className="bg-white dark:bg-[var(--bg-primary)] rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                Selecciona el nivel de dificultad:
              </label>
              <div className="flex gap-3">
                {(['easy', 'medium', 'hard'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${
                      difficulty === level
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)] hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {level === 'easy' && '🟢 Fácil'}
                    {level === 'medium' && '🟡 Medio'}
                    {level === 'hard' && '🔴 Difícil'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsStarted(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Comenzar Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !currentQuestion) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Generando preguntas...</p>
        </div>
      </div>
    );
  }

  if (currentQuestionIndex >= questions.length) {
    const percentage = Math.round((score / totalQuestions) * 100);
    
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-8 border border-green-200 dark:border-green-800 max-w-2xl mx-auto">
        <div className="text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto" />
          
          <div>
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
              ¡Quiz Completado!
            </h2>
            <p className="text-[var(--text-secondary)]">
              Excelente trabajo practicando escalas musicales
            </p>
          </div>

          <div className="bg-white dark:bg-[var(--bg-primary)] rounded-lg p-6">
            <div className="text-5xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {percentage}%
            </div>
            <div className="text-xl text-[var(--text-secondary)]">
              {score} de {totalQuestions} respuestas correctas
            </div>

            {percentage >= 80 && (
              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded text-sm text-green-800 dark:text-green-200">
                🌟 ¡Excelente! Tienes un gran dominio de las escalas
              </div>
            )}
            {percentage >= 60 && percentage < 80 && (
              <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded text-sm text-blue-800 dark:text-blue-200">
                👍 ¡Buen trabajo! Sigue practicando para mejorar más
              </div>
            )}
            {percentage < 60 && (
              <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm text-yellow-800 dark:text-yellow-200">
                💪 Sigue practicando, ¡lo harás mejor la próxima vez!
              </div>
            )}
          </div>

          <button
            onClick={handleReset}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Intentar de Nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress Bar */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-[var(--text-secondary)]">
            Pregunta {currentQuestionIndex + 1} de {totalQuestions}
          </span>
          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
            Puntuación: {score}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              {currentQuestion.type === 'identify' && '🎵 Identificar Escala'}
              {currentQuestion.type === 'position' && '📍 Identificar Posición'}
              {currentQuestion.type === 'interval' && '📏 Intervalos'}
            </div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)]">
              {currentQuestion.question}
            </h3>
          </div>
          
          {currentQuestion.type === 'identify' && (
            <button
              onClick={handlePlayAudio}
              className="ml-4 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex-shrink-0"
              title="Escuchar escala"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(option)}
              disabled={answered}
              className={`w-full p-4 rounded-lg border-2 font-semibold text-left transition-all ${
                selectedAnswer === option
                  ? isCorrect
                    ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'
                  : answered && option === currentQuestion.correctAnswer
                  ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300'
                  : 'bg-white dark:bg-[var(--bg-primary)] border-gray-300 dark:border-gray-600 text-[var(--text-primary)] hover:border-blue-500 cursor-pointer'
              } ${answered ? 'cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {selectedAnswer === option && isCorrect && <CheckCircle className="w-5 h-5" />}
                {selectedAnswer === option && !isCorrect && <XCircle className="w-5 h-5" />}
                {answered && option === currentQuestion.correctAnswer && selectedAnswer !== option && <CheckCircle className="w-5 h-5" />}
              </div>
            </button>
          ))}
        </div>

        {/* Explanation */}
        {answered && (
          <div className={`mt-4 p-4 rounded-lg ${isCorrect ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
            <p className={`font-semibold ${isCorrect ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
              {isCorrect ? '✓ ¡Correcto!' : '✗ Respuesta incorrecta'}
            </p>
            <p className={`text-sm mt-1 ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
              {currentQuestion.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {answered && (
        <div className="flex gap-3">
          <button
            onClick={handleNext}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {currentQuestionIndex === questions.length - 1 ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      )}

      {!answered && (
        <button
          onClick={handleSkip}
          className="w-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-[var(--text-primary)] font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <SkipForward className="w-5 h-5" />
          Saltar pregunta
        </button>
      )}
    </div>
  );
};

/**
 * Play scale audio using Web Audio API
 */
function playScaleAudio(intervals: number[]) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const baseFrequency = 261.63; // C4
  const noteDuration = 0.3;
  const gap = 0.05;

  let currentTime = audioContext.currentTime;

  intervals.forEach(interval => {
    const frequency = baseFrequency * Math.pow(2, interval / 12);
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration);

    oscillator.start(currentTime);
    oscillator.stop(currentTime + noteDuration);

    currentTime += noteDuration + gap;
  });
}
