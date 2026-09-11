import {
  storeTransitionEvent,
  consumeTransitionEvent,
  peekTransitionEvent,
  clearTransitionEvents,
} from './useLearningProgress';

describe('Transition Event Store', () => {
  beforeEach(() => {
    clearTransitionEvents();
  });

  it('stores and consumes transition event once', () => {
    const transition = {
      changed: true,
      courseId: 'c1',
      courseCompleted: true,
      unlockedCourseId: 'c2',
      xpAwarded: 135,
    };

    storeTransitionEvent(transition, 'user-1');

    // Peek should see it without consuming
    const peeked = peekTransitionEvent('user-1');
    expect(peeked).not.toBeNull();
    expect(peeked.courseId).toBe('c1');
    expect(peeked.consumed).toBe(false);

    // First consume should return it and mark consumed
    const consumed = consumeTransitionEvent('user-1');
    expect(consumed).not.toBeNull();
    expect(consumed.courseId).toBe('c1');

    // Second consume should return null
    const secondConsume = consumeTransitionEvent('user-1');
    expect(secondConsume).toBeNull();
  });

  it('ignores transition events with changed = false', () => {
    storeTransitionEvent({ changed: false, courseId: 'c1' }, 'user-1');
    expect(consumeTransitionEvent('user-1')).toBeNull();
  });

  it('isolates events by userId', () => {
    storeTransitionEvent({ changed: true, courseId: 'c1' }, 'user-1');
    // Different user cannot consume user-1 event
    expect(consumeTransitionEvent('user-2')).toBeNull();
    expect(peekTransitionEvent('user-2')).toBeNull();
  });

  it('clears all events on clearTransitionEvents', () => {
    storeTransitionEvent({ changed: true, courseId: 'c1' }, 'user-1');
    clearTransitionEvents();
    expect(consumeTransitionEvent('user-1')).toBeNull();
  });
});
