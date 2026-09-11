import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LearningStats from './learningPath/LearningStats';
import CourseNodeItem from './learningPath/CourseNodeItem';
import CourseDetailModal from './learningPath/CourseDetailModal';
import LearningPathSkeleton from './learningPath/LearningPathSkeleton';
import LearningPathMap from './learningPath/LearningPathMap';
import { getAdminUnlockCandidate, getLearnerUnlockCandidate, RoadmapOverview } from './Roadmap';
import { playUnlockSequence } from '../../utils/learningPathMotion';

const mockNavigate = jest.fn();

jest.mock('../../utils/learningPathMotion', () => ({
  animatePathReveal: jest.fn(() => null),
  animateCurrentPulse: jest.fn(() => null),
  killMotion: jest.fn(),
  killUnlockSequence: jest.fn(),
  playUnlockSequence: jest.fn(() => null),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('Learning Path UI Components', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    playUnlockSequence.mockClear();
  });

  describe('RoadmapOverview', () => {
    it('matches the roadmap controls without demo module or unlock actions', () => {
      const handleLayoutChange = jest.fn();

      render(
        <RoadmapOverview
          completedCourses={1}
          totalCourses={3}
          layoutMode="auto"
          onLayoutModeChange={handleLayoutChange}
        />
      );

      expect(screen.getByText('(1/3 chặng hoàn thành)')).toBeInTheDocument();
      expect(screen.queryByText(/\+1 Module/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Mở khóa chặng sau/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      fireEvent.click(screen.getByRole('button', { name: /Ngang/i }));
      expect(handleLayoutChange).toHaveBeenCalledWith('horizontal');
    });

    it('renders a real learner unlock action and a separate admin test action', () => {
      const handleUnlock = jest.fn();
      const handleAdminTest = jest.fn();

      render(
        <RoadmapOverview
          completedCourses={1}
          totalCourses={3}
          layoutMode="auto"
          onLayoutModeChange={jest.fn()}
          unlockAction={{ label: 'Mở khóa chặng tiếp theo', onClick: handleUnlock }}
          adminTestAction={{ label: 'Admin: Test mở khóa', onClick: handleAdminTest }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Mở khóa chặng tiếp theo/i }));
      fireEvent.click(screen.getByRole('button', { name: /Admin: Test mở khóa/i }));

      expect(handleUnlock).toHaveBeenCalledTimes(1);
      expect(handleAdminTest).toHaveBeenCalledTimes(1);
    });

    it('chooses a real adjacent course pair for the admin preview', () => {
      expect(
        getAdminUnlockCandidate([
          { id: 'ITN', status: 'completed' },
          { id: 'SRWE', status: 'current' },
          { id: 'ENSA', status: 'locked' },
        ])
      ).toEqual(
        expect.objectContaining({
          courseId: 'ITN',
          unlockedCourseId: 'SRWE',
          isAdminPreview: true,
        })
      );
      expect(getAdminUnlockCandidate([{ id: 'ITN', status: 'current' }])).toBeNull();
    });

    it('offers learner unlock only for a completed course followed by an unstarted current course', () => {
      const eligibleCourses = [
        { id: 'ITN', status: 'completed', progressPercent: 100, isStarted: true },
        { id: 'SRWE', status: 'current', progressPercent: 0, isStarted: false },
      ];

      expect(getLearnerUnlockCandidate(eligibleCourses)).toEqual(
        expect.objectContaining({
          courseId: 'ITN',
          unlockedCourseId: 'SRWE',
          isSnapshotUnlock: true,
        })
      );
      expect(
        getLearnerUnlockCandidate([
          eligibleCourses[0],
          { ...eligibleCourses[1], progressPercent: 10, isStarted: true },
        ])
      ).toBeNull();
    });
  });

  describe('LearningStats', () => {
    it('renders 4 metrics accurately from server stats', () => {
      const stats = {
        streakDays: 5,
        xp: 1250,
        badges: 2,
        overallProgress: 68,
      };

      render(<LearningStats stats={stats} />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Ngày liên tiếp')).toBeInTheDocument();

      expect(screen.getByText('1.250')).toBeInTheDocument();
      expect(screen.getByText('Điểm XP')).toBeInTheDocument();

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Huy hiệu đạt được')).toBeInTheDocument();

      expect(screen.getByText('68%')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '68');
    });

    it('handles empty or default stats without crashing', () => {
      render(<LearningStats />);
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('LearningPathMap unlock transition', () => {
    it('plays the unlock sequence only from a real course transition', () => {
      const nodes = [
        {
          id: 'c1',
          code: 'ITN',
          title: 'Introduction to Networks',
          iconType: 'network',
          status: 'completed',
          progressPercent: 100,
          nodeSize: 72,
          x: 100,
          y: 120,
          labelPlacement: 'bottom',
        },
        {
          id: 'c2',
          code: 'SRWE',
          title: 'Switching and Routing',
          iconType: 'switching',
          status: 'current',
          progressPercent: 0,
          nodeSize: 72,
          x: 320,
          y: 80,
          labelPlacement: 'top',
        },
      ];
      const segments = [
        {
          id: 'seg-c1-c2',
          fromId: 'c1',
          toId: 'c2',
          pathData: 'M 100 120 C 210 120, 210 80, 320 80',
          status: 'active',
        },
      ];

      render(
        <LearningPathMap
          nodes={nodes}
          segments={segments}
          currentCourseId="c2"
          unlockTransition={{
            changed: true,
            courseCompleted: true,
            courseId: 'c1',
            unlockedCourseId: 'c2',
            timestamp: 1,
          }}
        />
      );

      expect(playUnlockSequence).toHaveBeenCalledTimes(1);
      expect(playUnlockSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          completedNodeEl: expect.any(HTMLElement),
          connectingPathEl: expect.any(SVGElement),
          nextNodeEl: expect.any(HTMLElement),
        })
      );
    });
  });

  describe('CourseNodeItem', () => {
    const mockNode = {
      id: 'c1',
      code: 'ITN',
      title: 'Introduction to Networks',
      iconType: 'network',
      status: 'current',
      contentReady: false,
      progressPercent: 40,
      nodeSize: 72,
      x: 100,
      y: 150,
      labelPlacement: 'bottom',
    };

    it('renders accessible button with aria-label and triggers click handler', () => {
      const handleSelect = jest.fn();

      render(
        <CourseNodeItem
          node={mockNode}
          isCurrent={true}
          isCompleted={false}
          isLocked={false}
          onSelectCourse={handleSelect}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('ITN: Introduction to Networks, Đang học, tiến độ 40%')
      );
      expect(button).toHaveAttribute('aria-disabled', 'false');
      expect(screen.queryByText('Cập nhật')).not.toBeInTheDocument();

      fireEvent.click(button);
      expect(handleSelect).toHaveBeenCalledWith(mockNode);
    });

    it('handles locked status and reports aria-disabled=true with lockedReason', () => {
      const lockedNode = {
        ...mockNode,
        status: 'locked',
        lockedReason: 'Bạn cần hoàn thành ITN trước',
      };
      const handleLockedClick = jest.fn();

      render(
        <CourseNodeItem
          node={lockedNode}
          isCurrent={false}
          isCompleted={false}
          isLocked={true}
          onLockedClick={handleLockedClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Lý do khóa: Bạn cần hoàn thành ITN trước')
      );

      fireEvent.click(button);
      expect(handleLockedClick).toHaveBeenCalledWith(lockedNode);
    });

    it('triggers onSelectCourse on Enter and Space keys', () => {
      const handleSelect = jest.fn();

      render(<CourseNodeItem node={mockNode} isCurrent={true} onSelectCourse={handleSelect} />);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleSelect).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe('CourseDetailModal', () => {
    const mockCourse = {
      id: 'c1',
      code: 'ITN',
      title: 'Introduction to Networks',
      description: 'Khóa học nền tảng kết nối mạng CCNA',
      status: 'current',
      progressPercent: 50,
      totalModules: 3,
      completedModules: 1,
      totalLessons: 10,
      completedLessons: 5,
      totalLabs: 2,
      completedLabs: 1,
      estimatedHours: 0.7,
      badgeName: 'Network Fundamentals',
      skills: ['Mô hình OSI', 'Địa chỉ IPv4', 'Cấu hình Switch'],
      modules: [
        {
          id: 'm1',
          title: 'Chương 1: Khái niệm mạng cơ bản',
          status: 'completed',
          totalLessons: 2,
          completedLessons: 2,
          totalLabs: 0,
          completedLabs: 0,
          duration: '25 phút',
          lessons: [
            { id: 1, title: 'Bài 1: Tổng quan', videoDuration: '10:00', completed: true },
            { id: 2, title: 'Bài 2: Cáp mạng', videoDuration: '15:00', completed: true },
          ],
          labs: [],
        },
        {
          id: 'm2',
          title: 'Chương 2: Cấu hình thiết bị',
          status: 'current',
          totalLessons: 2,
          completedLessons: 1,
          totalLabs: 1,
          completedLabs: 0,
          duration: '30 phút',
          lessons: [
            { id: 3, title: 'Bài 3: CLI Cisco', videoDuration: '12:00', completed: true },
            { id: 4, title: 'Bài 4: Password & Banner', videoDuration: '18:00', completed: false },
          ],
          labs: [
            {
              id: 101,
              title: 'Lab 1: Cấu hình Switch cơ bản',
              labType: 'CLI_SIMULATION',
              completed: false,
            },
          ],
        },
      ],
      nextLessonId: 4,
    };

    it('renders modal dialog with course title, stats, skills and modules', () => {
      render(<CourseDetailModal course={mockCourse} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Introduction to Networks')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('1 / 3')).toBeInTheDocument(); // completed / total modules
      expect(screen.getByText('0,7 giờ')).toBeInTheDocument();
      expect(screen.getByText('Network Fundamentals')).toBeInTheDocument();
      expect(screen.getByText('25 phút')).toBeInTheDocument();
      expect(screen.getByText('Mô hình OSI')).toBeInTheDocument();
      expect(screen.getByText('Chương 1: Khái niệm mạng cơ bản')).toBeInTheDocument();
      expect(screen.getByText('Lab 1: Cấu hình Switch cơ bản')).toBeInTheDocument();
      expect(screen.queryByText(/Test Unlock/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Đánh dấu hoàn thành/i)).not.toBeInTheDocument();
    });

    it('closes on Escape key press and on close button click', () => {
      const handleClose = jest.fn();

      render(<CourseDetailModal course={mockCourse} isOpen={true} onClose={handleClose} />);

      const closeBtn = screen.getByLabelText('Đóng cửa sổ chi tiết khóa học');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('renders locked banner when course is locked', () => {
      const lockedCourse = {
        ...mockCourse,
        status: 'locked',
        lockedReason: 'Cần hoàn thành ITN để mở khóa',
      };

      render(<CourseDetailModal course={lockedCourse} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText('Khóa học đang bị khóa')).toBeInTheDocument();
      expect(screen.getByText('Cần hoàn thành ITN để mở khóa')).toBeInTheDocument();
    });

    it('navigates to next lesson on continue button click', () => {
      const handleClose = jest.fn();

      render(<CourseDetailModal course={mockCourse} isOpen={true} onClose={handleClose} />);

      const continueBtn = screen.getByText('Tiếp tục vào bài học');
      fireEvent.click(continueBtn);

      expect(handleClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/lesson?course=c1&lesson=4');
    });

    it('opens a real lesson from an accessible module without changing completion locally', () => {
      const handleClose = jest.fn();

      render(<CourseDetailModal course={mockCourse} isOpen={true} onClose={handleClose} />);

      fireEvent.click(screen.getByRole('button', { name: /Module 2:.*Đang học/i }));

      expect(handleClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/lesson?course=c1&lesson=4');
      expect(screen.queryByText(/Test Unlock/i)).not.toBeInTheDocument();
    });

    it('shows an explicit empty state when admin has not configured focus skills', () => {
      render(
        <CourseDetailModal
          course={{ ...mockCourse, skills: [] }}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('Admin chưa cập nhật kỹ năng trọng tâm.')).toBeInTheDocument();
    });
  });

  describe('LearningPathSkeleton', () => {
    it('renders skeleton loading state without crashing', () => {
      render(<LearningPathSkeleton isDesktop={true} />);
      expect(screen.getByLabelText('Đang tải lộ trình học tập')).toBeInTheDocument();
    });
  });
});
