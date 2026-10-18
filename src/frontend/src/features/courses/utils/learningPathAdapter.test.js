import {
  normalizeLesson,
  normalizeLab,
  normalizeModule,
  normalizeCourse,
  normalizeLearningPath,
} from './learningPathAdapter';

describe('learningPathAdapter', () => {
  describe('normalizeLesson', () => {
    it('normalizes basic lesson and clamps progressPercent', () => {
      const lesson = normalizeLesson({
        id: 10,
        title: 'Overview',
        orderIndex: 1,
        videoDuration: '12:30',
        progressPercent: 120, // should clamp to 100
        completed: true,
      });

      expect(lesson).toEqual({
        id: 10,
        title: 'Overview',
        orderIndex: 1,
        videoDuration: '12:30',
        progressPercent: 100,
        completed: true,
      });
    });

    it('handles empty / undefined inputs safely', () => {
      const lesson = normalizeLesson();
      expect(lesson.id).toBe(0);
      expect(lesson.completed).toBe(false);
      expect(lesson.progressPercent).toBe(0);
    });
  });

  describe('normalizeLab', () => {
    it('normalizes lab and defaults type', () => {
      const lab = normalizeLab({
        id: '5',
        title: 'Basic Switch Config',
        labType: 'CLI_SIMULATION',
        progressPercent: 50,
      });

      expect(lab).toEqual({
        id: 5,
        title: 'Basic Switch Config',
        moduleId: null,
        labType: 'CLI_SIMULATION',
        progressPercent: 50,
        completed: false,
      });
    });
  });

  describe('normalizeModule', () => {
    it('preserves status, canAccess, and lockedReason from server', () => {
      const mod = normalizeModule({
        id: 'mod-1',
        title: 'Chương 1: Giới thiệu',
        status: 'locked',
        canAccess: false,
        lockedReason: 'Bạn cần hoàn thành chương trước',
        lessons: [{ id: 1, title: 'L1', completed: false }],
        labs: [],
      });

      expect(mod.status).toBe('locked');
      expect(mod.canAccess).toBe(false);
      expect(mod.lockedReason).toBe('Bạn cần hoàn thành chương trước');
      expect(mod.totalLessons).toBe(1);
      expect(mod.completedLessons).toBe(0);
    });
  });

  describe('normalizeCourse', () => {
    it('preserves server status, canAccess, and maps iconType correctly', () => {
      const course = normalizeCourse(
        {
          id: 'c1',
          code: 'ITN',
          title: 'Introduction to Networks',
          status: 'current',
          canAccess: true,
          progressPercent: 45,
          estimatedHours: 1.2,
          skills: ['IPv4 subnetting'],
          badgeName: 'Network Fundamentals',
          modules: [
            {
              id: 'm1',
              title: 'Module 1',
              status: 'completed',
              completed: true,
              lessons: [{ id: 1, completed: true }],
            },
            {
              id: 'm2',
              title: 'Module 2',
              status: 'current',
              completed: false,
              lessons: [{ id: 2, completed: false }],
            },
          ],
        },
        0
      );

      expect(course.id).toBe('c1');
      expect(course.status).toBe('current');
      expect(course.canAccess).toBe(true);
      expect(course.iconType).toBe('network');
      expect(course.totalModules).toBe(2);
      expect(course.completedModules).toBe(1);
      expect(course.estimatedHours).toBe(1.2);
      expect(course.skills).toEqual(['IPv4 subnetting']);
      expect(course.badgeName).toBe('Network Fundamentals');
    });

    it('infers switching for SRWE and enterprise for ENSA', () => {
      const srwe = normalizeCourse({ id: 'c2', code: 'SRWE' }, 1);
      const ensa = normalizeCourse({ id: 'c3', code: 'ENSA' }, 2);
      expect(srwe.iconType).toBe('switching');
      expect(ensa.iconType).toBe('enterprise');
    });

    it('does not invent a badge when the backend has not configured one', () => {
      expect(normalizeCourse({ id: 'c4', title: 'Course 4' }).badgeName).toBeNull();
    });

    it('removes the trailing Updated marker from a real course title', () => {
      const course = normalizeCourse({
        id: 'ITN',
        code: 'ITN',
        title: 'Introduction to Networks (Updated)',
      });

      expect(course.title).toBe('Introduction to Networks');
    });
  });

  describe('normalizeLearningPath', () => {
    it('handles empty learning path response gracefully', () => {
      const path = normalizeLearningPath({
        data: {
          courses: [],
          stats: { streakDays: 0, xp: 0, badges: 0, overallProgress: 0 },
          currentCourseId: null,
        },
      });

      expect(path.courses).toEqual([]);
      expect(path.stats).toEqual({
        streakDays: 0,
        xp: 0,
        badges: 0,
        overallProgress: 0,
      });
      expect(path.currentCourseId).toBeNull();
    });

    it('finds currentCourseId if backend returned null but a current course exists', () => {
      const path = normalizeLearningPath({
        courses: [
          { id: 'c1', status: 'completed', progressPercent: 100 },
          { id: 'c2', status: 'current', progressPercent: 20 },
          { id: 'c3', status: 'locked', progressPercent: 0 },
        ],
        stats: { streakDays: 3, xp: 250, badges: 1, overallProgress: 40 },
        currentCourseId: null,
      });

      expect(path.currentCourseId).toBe('c2');
      expect(path.courses[0].status).toBe('completed');
      expect(path.courses[1].status).toBe('current');
      expect(path.courses[2].status).toBe('locked');
      expect(path.stats.xp).toBe(250);
      expect(path.stats.streakDays).toBe(3);
    });
  });
});
