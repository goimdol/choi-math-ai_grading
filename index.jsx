import { useState, useRef } from "react";

// ── 상수 ──────────────────────────────────────────────
const NAVY = "#0D1B2A";
const CARD = "#152236";
const BORDER = "#1E3250";
const YELLOW = "#F5C518";
const GREEN = "#22C55E";
const RED = "#EF4444";
const MUTED = "#5B7A9D";

// ── 공통 스타일 ──────────────────────────────────────
const btn = (active, color = YELLOW) => ({
  padding: "11px 18px",
  borderRadius: 10,
  border: `2px solid ${active ? color : BORDER}`,
  background: active ? color : CARD,
  color: active ? NAVY : MUTED,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  transition: "all 0.15s",
  fontFamily: "inherit",
});

const card = (extra = {}) => ({
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: "16px 18px",
  ...extra,
});

// ── API 호출 ──────────────────────────────────────────
async function callClaude(messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages,
    }),
  });
  const data = await res.json();
  return data.content.map(i => i.text || "").join("");
}

// ── 메인 앱 ──────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("teacher"); // teacher | student

  return (
    <div style={{
      minHeight: "100vh",
      background: NAVY,
      fontFamily: "'Noto Sans KR', sans-serif",
      color: "#fff",
      padding: "20px 16px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet" />

      {/* 헤더 */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          display: "inline-block",
          background: YELLOW,
          color: NAVY,
          fontWeight: 900,
          fontSize: 10,
          padding: "3px 12px",
          borderRadius: 20,
          letterSpacing: 2,
          marginBottom: 8,
        }}>최선생수학학원 · AI 자동채점</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>스마트 채점 시스템</h1>
      </div>

      {/* 모드 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button style={{ ...btn(mode === "teacher"), flex: 1 }} onClick={() => setMode("teacher")}>
          👩‍🏫 선생님 모드
        </button>
        <button style={{ ...btn(mode === "student", "#60A5FA"), flex: 1 }} onClick={() => setMode("student")}>
          🎒 학생 모드
        </button>
      </div>

      {mode === "teacher" ? <TeacherMode /> : <StudentMode />}
    </div>
  );
}

// ── 선생님 모드: 정답 페이지 사진 → 정답 추출 ──────────
function TeacherMode() {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [bookName, setBookName] = useState("");
  const [unit, setUnit] = useState("");
  const [answers, setAnswers] = useState(null); // [{no, answer}]
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    setAnswers(null);
    setSaved(false);
    const reader = new FileReader();
    reader.onload = (ev) => setImageBase64(ev.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const extract = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setAnswers(null);
    try {
      const prompt = `이것은 수학 교재의 정답 페이지 사진입니다.
사진에서 문제 번호와 정답을 모두 추출해주세요.

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "answers": [
    {"no": "1", "answer": "3"},
    {"no": "2", "answer": "x=5"},
    {"no": "3", "answer": "12"}
  ]
}

객관식은 번호(1~5), 단답형은 값, 서술형은 핵심 답만 추출해주세요.`;

      const text = await callClaude([{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
          { type: "text", text: prompt }
        ]
      }]);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAnswers(parsed.answers);
    } catch {
      setAnswers([]);
    }
    setLoading(false);
  };

  const save = () => {
    if (!answers || !bookName) return;
    const key = `answers_${bookName}_${unit}`;
    localStorage.setItem(key, JSON.stringify(answers));
    // 교재 목록에도 추가
    const books = JSON.parse(localStorage.getItem("books") || "[]");
    const entry = { bookName, unit, key, count: answers.length };
    const idx = books.findIndex(b => b.key === key);
    if (idx >= 0) books[idx] = entry; else books.push(entry);
    localStorage.setItem("books", JSON.stringify(books));
    setSaved(true);
  };

  return (
    <div>
      {/* 교재 정보 */}
      <div style={{ ...card(), marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: YELLOW, fontWeight: 700, marginBottom: 10 }}>📚 교재 정보 입력</div>
        <input
          value={bookName}
          onChange={e => setBookName(e.target.value)}
          placeholder="교재명 (예: 쎈 수학 중2)"
          style={inputStyle()}
        />
        <input
          value={unit}
          onChange={e => setUnit(e.target.value)}
          placeholder="단원 (예: 3단원 / p.45~52)"
          style={{ ...inputStyle(), marginTop: 8 }}
        />
      </div>

      {/* 정답 페이지 업로드 */}
      <div style={{ ...card(), marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: YELLOW, fontWeight: 700, marginBottom: 10 }}>📷 정답 페이지 사진</div>
        <input type="file" accept="image/*" ref={fileRef} onChange={handleImage} style={{ display: "none" }} />
        <div
          onClick={() => fileRef.current.click()}
          style={{
            border: `2px dashed ${image ? YELLOW : BORDER}`,
            borderRadius: 10,
            padding: 20,
            textAlign: "center",
            cursor: "pointer",
            minHeight: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {image ? (
            <img src={image} alt="정답페이지" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8 }} />
          ) : (
            <>
              <div style={{ fontSize: 28 }}>📄</div>
              <div style={{ color: MUTED, fontSize: 13 }}>교재 정답 페이지를 촬영해서 올려주세요</div>
            </>
          )}
        </div>
      </div>

      {/* 추출 버튼 */}
      <button
        onClick={extract}
        disabled={loading || !imageBase64}
        style={{
          width: "100%",
          padding: 14,
          background: loading || !imageBase64 ? CARD : YELLOW,
          color: loading || !imageBase64 ? MUTED : NAVY,
          border: `2px solid ${loading || !imageBase64 ? BORDER : YELLOW}`,
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 900,
          cursor: loading || !imageBase64 ? "not-allowed" : "pointer",
          marginBottom: 16,
          fontFamily: "inherit",
        }}
      >
        {loading ? "⏳ AI가 정답 추출 중..." : "🤖 정답 자동 추출"}
      </button>

      {/* 추출 결과 */}
      {answers && answers.length > 0 && (
        <div style={{ ...card(), marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: YELLOW, fontWeight: 700 }}>
              ✅ 추출된 정답 ({answers.length}문제)
            </div>
            <button
              onClick={() => {
                const edited = prompt("수정할 번호와 정답을 입력 (예: 3번 = x+2)");
                if (!edited) return;
                const [noStr, ans] = edited.split("=").map(s => s.trim());
                const no = noStr.replace("번", "").trim();
                setAnswers(prev => prev.map(a => a.no === no ? { ...a, answer: ans } : a));
              }}
              style={{ fontSize: 11, color: MUTED, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              ✏️ 수정
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {answers.map(a => (
              <div key={a.no} style={{
                background: "#0D1B2A",
                borderRadius: 8,
                padding: "8px 6px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>{a.no}번</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: YELLOW }}>{a.answer}</div>
              </div>
            ))}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={save}
            disabled={!bookName || saved}
            style={{
              width: "100%",
              marginTop: 14,
              padding: 12,
              background: saved ? "#0F3320" : GREEN,
              color: saved ? GREEN : NAVY,
              border: `2px solid ${saved ? GREEN : "transparent"}`,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 900,
              cursor: !bookName || saved ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saved ? "✅ 저장 완료! 학생들이 채점 가능해요" : bookName ? "💾 정답 저장하기" : "⚠️ 교재명을 먼저 입력하세요"}
          </button>
        </div>
      )}

      {answers && answers.length === 0 && (
        <div style={{ ...card(), textAlign: "center", color: RED }}>
          정답을 추출하지 못했어요. 사진을 다시 찍어주세요.
        </div>
      )}

      {/* 저장된 교재 목록 */}
      <SavedBookList />
    </div>
  );
}

// 저장된 교재 목록
function SavedBookList() {
  const books = JSON.parse(localStorage.getItem("books") || "[]");
  if (books.length === 0) return null;
  return (
    <div style={{ ...card(), marginTop: 14 }}>
      <div style={{ fontSize: 11, color: YELLOW, fontWeight: 700, marginBottom: 10 }}>📂 저장된 교재 정답</div>
      {books.map(b => (
        <div key={b.key} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{b.bookName}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{b.unit} · {b.count}문제</div>
          </div>
          <div style={{ fontSize: 11, color: GREEN }}>등록완료</div>
        </div>
      ))}
    </div>
  );
}

// ── 학생 모드: 교재 선택 → 답 입력 → 채점 ────────────
function StudentMode() {
  const books = JSON.parse(localStorage.getItem("books") || "[]");
  const [selectedBook, setSelectedBook] = useState(null);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [studentName, setStudentName] = useState("");

  const bookAnswers = selectedBook
    ? JSON.parse(localStorage.getItem(selectedBook.key) || "[]")
    : [];

  const grade = async () => {
    if (!selectedBook || Object.keys(answers).length === 0) return;
    setLoading(true);

    const correct = [];
    const wrong = [];

    for (const a of bookAnswers) {
      const studentAns = (answers[a.no] || "").trim();
      if (!studentAns) continue;

      try {
        const prompt = `수학 채점을 해주세요.
정답: ${a.answer}
학생 답안: ${studentAns}

수학적으로 동일한 값이면 정답으로 처리해주세요. (예: 1/2 = 0.5, x=3 = 3)
JSON으로만 응답: {"correct": true 또는 false}`;

        const text = await callClaude([{ role: "user", content: prompt }]);
        const clean = text.replace(/```json|```/g, "").trim();
        const res = JSON.parse(clean);
        if (res.correct) {
          correct.push(a.no);
        } else {
          wrong.push({ no: a.no, correct: a.answer, student: studentAns });
        }
      } catch {
        wrong.push({ no: a.no, correct: a.answer, student: studentAns });
      }
    }

    const total = correct.length + wrong.length;
    setResults({ correct, wrong, total, score: Math.round(correct.length / total * 100) });
    setLoading(false);
  };

  if (books.length === 0) {
    return (
      <div style={{ ...card(), textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
        <div style={{ color: MUTED, fontSize: 14 }}>아직 등록된 교재가 없어요.</div>
        <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>선생님 모드에서 정답을 먼저 등록해주세요.</div>
      </div>
    );
  }

  return (
    <div>
      {/* 학생 이름 */}
      <div style={{ ...card(), marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#60A5FA", fontWeight: 700, marginBottom: 8 }}>👤 학생 이름</div>
        <input
          value={studentName}
          onChange={e => setStudentName(e.target.value)}
          placeholder="이름을 입력하세요"
          style={inputStyle()}
        />
      </div>

      {/* 교재 선택 */}
      <div style={{ ...card(), marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#60A5FA", fontWeight: 700, marginBottom: 10 }}>📚 교재 선택</div>
        {books.map(b => (
          <div
            key={b.key}
            onClick={() => { setSelectedBook(b); setAnswers({}); setResults(null); }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `2px solid ${selectedBook?.key === b.key ? "#60A5FA" : BORDER}`,
              background: selectedBook?.key === b.key ? "#0D2140" : "transparent",
              cursor: "pointer",
              marginBottom: 6,
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>{b.bookName}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{b.unit} · {b.count}문제</div>
          </div>
        ))}
      </div>

      {/* 답 입력 */}
      {selectedBook && bookAnswers.length > 0 && !results && (
        <div style={{ ...card(), marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#60A5FA", fontWeight: 700, marginBottom: 12 }}>
            ✏️ 답 입력 ({bookAnswers.length}문제)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bookAnswers.map(a => (
              <div key={a.no} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  minWidth: 36,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: MUTED,
                  background: "#0D1B2A",
                  padding: "6px 4px",
                  borderRadius: 6,
                }}>
                  {a.no}번
                </div>
                <input
                  value={answers[a.no] || ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [a.no]: e.target.value }))}
                  placeholder="답 입력"
                  style={{ ...inputStyle(), margin: 0, flex: 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 채점 버튼 */}
      {selectedBook && !results && (
        <button
          onClick={grade}
          disabled={loading || Object.keys(answers).length === 0}
          style={{
            width: "100%",
            padding: 14,
            background: loading || Object.keys(answers).length === 0 ? CARD : "#60A5FA",
            color: loading || Object.keys(answers).length === 0 ? MUTED : NAVY,
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 900,
            cursor: loading || Object.keys(answers).length === 0 ? "not-allowed" : "pointer",
            marginBottom: 16,
            fontFamily: "inherit",
          }}
        >
          {loading ? "⏳ AI 채점 중..." : "🤖 채점하기"}
        </button>
      )}

      {/* 결과 */}
      {results && (
        <div>
          <div style={{
            ...card({ background: results.score >= 80 ? "#0D2B1A" : results.score >= 60 ? "#1A200A" : "#2B0D0D" }),
            border: `2px solid ${results.score >= 80 ? GREEN : results.score >= 60 ? YELLOW : RED}`,
            textAlign: "center",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>
              {studentName || "학생"} · {selectedBook.bookName}
            </div>
            <div style={{
              fontSize: 52,
              fontWeight: 900,
              color: results.score >= 80 ? GREEN : results.score >= 60 ? YELLOW : RED,
              lineHeight: 1,
            }}>
              {results.score}점
            </div>
            <div style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>
              {results.total}문제 중 {results.correct.length}개 정답
            </div>
          </div>

          {/* 정답 목록 */}
          {results.correct.length > 0 && (
            <div style={{ ...card(), marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, marginBottom: 8 }}>✅ 정답 ({results.correct.length}개)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {results.correct.map(no => (
                  <span key={no} style={{
                    background: "#0D2B1A",
                    border: `1px solid ${GREEN}44`,
                    color: GREEN,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                  }}>{no}번</span>
                ))}
              </div>
            </div>
          )}

          {/* 오답 목록 */}
          {results.wrong.length > 0 && (
            <div style={{ ...card(), marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: RED, fontWeight: 700, marginBottom: 8 }}>❌ 오답 ({results.wrong.length}개)</div>
              {results.wrong.map(w => (
                <div key={w.no} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: `1px solid ${BORDER}`,
                  fontSize: 13,
                }}>
                  <span style={{ color: MUTED }}>{w.no}번</span>
                  <span>
                    <span style={{ color: RED, marginRight: 8 }}>내 답: {w.student}</span>
                    <span style={{ color: GREEN }}>정답: {w.correct}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => { setResults(null); setAnswers({}); }}
            style={{
              width: "100%",
              padding: 12,
              background: CARD,
              color: "#60A5FA",
              border: `2px solid #60A5FA`,
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🔄 다시 채점하기
          </button>
        </div>
      )}
    </div>
  );
}

// ── 공통 input 스타일 ─────────────────────────────────
function inputStyle() {
  return {
    width: "100%",
    padding: "11px 14px",
    background: "#0D1B2A",
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    color: "#fff",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };
}
