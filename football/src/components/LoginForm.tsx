import { useState } from "react";
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      if (!response.ok) throw new Error("비밀번호 또는 아이디 오류입니다.");

      await response.json();
      //navigate("/dashboard")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그인실패");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      {errorMessage && <p>{errorMessage}</p>}
      <label>
        이메일
        <input
          type="email"
          value={email}
          placeholder="이메일을 입력해주세요."
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
       
      </label>
      <label>
        비밀번호
        <input
          type="password"
          value={password}
          placeholder="비밀번호를 입력해주세요."
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
      </label>

      <button>로그인</button>
    </form>
  );
}
export default LoginForm;
