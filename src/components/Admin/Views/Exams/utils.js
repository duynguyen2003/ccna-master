import { OPTION_LABELS } from './constants';

export const getStatusFromExam = (exam) => exam?.status || 'DRAFT';

export const getDifficultyLabel = (difficulty) => {
  const mapping = {
    EASY: 'Dễ',
    MEDIUM: 'Trung bình',
    HARD: 'Khó'
  };
  return mapping[difficulty] || 'Chưa đặt';
};

export const normalizeQuestionFromApi = (questionItem) => {
  const options = Array.isArray(questionItem?.options) ? questionItem.options : ['', '', '', ''];
  
  let correctAnswers = questionItem?.correctAnswer;
  // Xử lý dữ liệu từ DB (Json/Int)
  if (!Array.isArray(correctAnswers)) {
    const single = Number.isInteger(Number(correctAnswers)) ? Number(correctAnswers) : 0;
    correctAnswers = [single];
  }

  return {
    question: `${questionItem?.question || ''}`,
    options: options,
    correctAnswer: correctAnswers,
    explanation: `${questionItem?.explanation || ''}`,
    imageUrl: `${questionItem?.imageUrl || ''}`
  };
};

export const parseCorrectAnswer = (value) => {
  const valStr = `${value || ''}`.trim();
  if (!valStr) return [];

  // Hỗ trợ cả single choice (A, 0) và multiple choice (A,B hoặc 0,2)
  return valStr.split(/[,;|]/)
    .map(s => s.trim())
    .map(s => {
      const idx = OPTION_LABELS.indexOf(s.toUpperCase());
      return idx !== -1 ? idx : parseInt(s, 10);
    })
    .filter(n => !Number.isNaN(n) && n >= 0);
};

export const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

export const toImportedQuestionsFromCsv = (csvText) => {
  const rows = csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);

  if (rows.length === 0) return [];

  const firstRow = rows[0].map((value) => value.toLowerCase());
  const hasHeader = firstRow.includes('question') && (firstRow.includes('optiona') || firstRow.includes('option_a'));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => ({
    question: row[0] || '',
    optionA: row[1] || '',
    optionB: row[2] || '',
    optionC: row[3] || '',
    optionD: row[4] || '',
    correctAnswer: row[5] || '',
    explanation: row[6] || '',
    imageUrl: row[7] || ''
  }));
};

export const normalizeImportedQuestion = (rawQuestion, index) => {
  const questionText = `${rawQuestion?.question || rawQuestion?.content || ''}`.trim();
  if (!questionText) {
    throw new Error(`Dòng ${index + 1}: thiếu nội dung câu hỏi.`);
  }

  const options = Array.isArray(rawQuestion?.options)
    ? rawQuestion.options.map(opt => `${opt || ''}`.trim())
    : [
        `${rawQuestion?.optionA || rawQuestion?.a || ''}`.trim(),
        `${rawQuestion?.optionB || rawQuestion?.b || ''}`.trim(),
        `${rawQuestion?.optionC || rawQuestion?.c || ''}`.trim(),
        `${rawQuestion?.optionD || rawQuestion?.d || ''}`.trim(),
        `${rawQuestion?.optionE || rawQuestion?.e || ''}`.trim(),
        `${rawQuestion?.optionF || rawQuestion?.f || ''}`.trim()
      ].filter(opt => opt !== '');

  if (options.length < 2) {
    throw new Error(`Dòng ${index + 1}: cần ít nhất 2 đáp án.`);
  }

  const correctAnswer = parseCorrectAnswer(rawQuestion?.correctAnswer ?? rawQuestion?.answer);

  return {
    question: questionText,
    options,
    correctAnswer,
    explanation: `${rawQuestion?.explanation || ''}`.trim(),
    imageUrl: `${rawQuestion?.imageUrl || ''}`.trim()
  };
};

export const formatExamDate = (value) => {
  if (!value) return '--/--/----';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('vi-VN');
};
