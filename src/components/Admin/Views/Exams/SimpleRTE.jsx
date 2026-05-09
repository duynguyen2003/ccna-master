import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Code, List, Sigma } from 'lucide-react';
import '../../../../css/Admin/AdminExamBuilder.css'; // Make sure styles are applied

const SimpleRTE = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleCodeBlock = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    // Check if we are inside a code block already
    let node = selection.anchorNode;
    let isCode = false;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'PRE' || node.nodeName === 'CODE') {
        isCode = true;
        break;
      }
      node = node.parentNode;
    }

    if (isCode) {
      document.execCommand('formatBlock', false, 'p');
    } else {
      document.execCommand('formatBlock', false, 'pre');
    }
    editorRef.current.focus();
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div className="efb-rte-container">
      <div className="efb-rte-toolbar">
        <button type="button" onClick={() => handleCommand('bold')} title="In đậm"><Bold size={15} /></button>
        <button type="button" onClick={() => handleCommand('italic')} title="In nghiêng"><Italic size={15} /></button>
        <button type="button" onClick={() => handleCommand('underline')} title="Gạch chân"><Underline size={15} /></button>
        <div className="efb-rte-divider" />
        <button type="button" onClick={handleCodeBlock} title="Đoạn mã (Code block)"><Code size={15} /></button>
        <button type="button" onClick={() => handleCommand('insertUnorderedList')} title="Danh sách"><List size={15} /></button>
        <button type="button" onClick={() => handleCommand('insertText', 'Σ')} title="Chèn ký tự"><Sigma size={15} /></button>
      </div>
      <div
        ref={editorRef}
        className="efb-rte-content"
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder || 'Nhập nội dung tại đây...'}
      />
    </div>
  );
};

export default SimpleRTE;
