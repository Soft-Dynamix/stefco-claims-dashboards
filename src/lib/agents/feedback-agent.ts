/**
 * Feedback Agent
 *
 * Triggered when user edits classification or corrects claim data.
 * Compares predicted values against corrected values to generate
 * learning signals that improve future classifications.
 *
 * Learning signals:
 * - "increase_weight" — User confirmed correct → boost patterns
 * - "decrease_weight" — User corrected → reduce trust in original pattern
 * - "neutral" — No clear signal (e.g., just flagged for review)
 */

export interface FeedbackSignal {
  wasCorrect: boolean
  correction: string
  learningSignal: 'increase_weight' | 'decrease_weight' | 'neutral'
  affectedFields: string[]
  severity: 'high' | 'medium' | 'low'
}

/**
 * Generate a feedback signal from user action.
 */
export function generateFeedbackSignal(params: {
  predictedClass: string | null
  finalClass: string | null
  feedbackType: 'confirmed_correct' | 'flagged_incorrect' | 'field_corrected'
  correctedFields?: string[]
  originalConfidence: number
}): FeedbackSignal {
  const { predictedClass, finalClass, feedbackType, correctedFields, originalConfidence } = params

  // Confirmed correct → increase weight for the prediction
  if (feedbackType === 'confirmed_correct') {
    return {
      wasCorrect: true,
      correction: 'none',
      learningSignal: 'increase_weight',
      affectedFields: [],
      severity: originalConfidence >= 80 ? 'high' : originalConfidence >= 50 ? 'medium' : 'low',
    }
  }

  // Flagged incorrect → neutral signal (user just wants it reviewed)
  if (feedbackType === 'flagged_incorrect') {
    return {
      wasCorrect: false,
      correction: 'flagged_for_review',
      learningSignal: 'neutral',
      affectedFields: [],
      severity: 'medium',
    }
  }

  // Field corrected → decrease weight for the fields that were wrong
  if (feedbackType === 'field_corrected' && correctedFields && correctedFields.length > 0) {
    return {
      wasCorrect: false,
      correction: `fields_corrected: ${correctedFields.join(', ')}`,
      learningSignal: 'decrease_weight',
      affectedFields: correctedFields,
      severity: correctedFields.length >= 3 ? 'high' : correctedFields.length >= 2 ? 'medium' : 'low',
    }
  }

  return {
    wasCorrect: true,
    correction: 'none',
    learningSignal: 'neutral',
    affectedFields: [],
    severity: 'low',
  }
}

/**
 * Compare predicted class against final class (if user changed classification).
 */
export function compareClassification(
  predictedClass: string | null,
  finalClass: string | null
): FeedbackSignal {
  if (!predictedClass || !finalClass) {
    return {
      wasCorrect: true,
      correction: 'none',
      learningSignal: 'neutral',
      affectedFields: [],
      severity: 'low',
    }
  }

  const isCorrect = predictedClass === finalClass

  return {
    wasCorrect: isCorrect,
    correction: isCorrect ? 'none' : `classification_changed: ${predictedClass} → ${finalClass}`,
    learningSignal: isCorrect ? 'increase_weight' : 'decrease_weight',
    affectedFields: ['classification'],
    severity: isCorrect ? 'low' : 'high',
  }
}
