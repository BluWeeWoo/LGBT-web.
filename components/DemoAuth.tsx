"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Globe2, MapPin } from "lucide-react";
import { Brand } from "./Brand";
import Globe from "./Globe";
import { samples } from "../lib/voices";
import { enterDemo, followSession } from "../lib/demo-session";

type Field = "name" | "email" | "password" | "confirmation";
const labels = { name: "Display name", email: "Email address", password: "Password", confirmation: "Confirm password" };
const signupFields: Field[] = ["name", "email", "password", "confirmation"];
const loginFields: Field[] = ["email", "password"];

export default function DemoAuth({ mode, forShare }: { mode: "signup" | "login"; forShare: boolean }) {
  const signup = mode === "signup";
  const fields = signup ? signupFields : loginFields;
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmation: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [visible, setVisible] = useState({ password: false, confirmation: false });
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const errors: Partial<Record<Field, string>> = {};
  if (signup && !values.name.trim()) errors.name = "Enter a display name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!values.password) errors.password = "Enter a password.";
  else if (signup && values.password.length < 8) errors.password = "Use at least 8 characters.";
  if (signup && !values.confirmation) errors.confirmation = "Confirm your password.";
  else if (signup && values.confirmation !== values.password) errors.confirmation = "Your passwords need to match.";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const invalid = fields.find(field => errors[field]);
    if (invalid) {
      setTouched(Object.fromEntries(fields.map(field => [field, true])));
      document.getElementById("auth-" + invalid)?.focus();
      return;
    }
    setBusy(true);
    setIssue("");
    try {
      const destination = await enterDemo(values.email, signup, forShare);
      setValues({ name: "", email: "", password: "", confirmation: "" });
      followSession(destination);
    } catch (cause) {
      setIssue(cause instanceof DOMException && cause.name === "SecurityError"
        ? "Allow site storage in this browser to continue the demo."
        : "Login could not be completed. Please try again.");
      setBusy(false);
    }
  }
  const voice = samples[0];
  return (
    <div className="auth-page">
      <header className="site-header">
        <div className="wrap auth-header">
          <a href="/" aria-label="RYE home"><Brand /></a>
          <a className="btn outline" href="/"><Globe2 size={16} />Explore the atlas</a>
        </div>
      </header>
      <main className="auth-layout">
        <aside className="auth-art" aria-label="Featured atlas story">
          <div className="auth-art-title"><Globe2 size={17} /><span>The story atlas</span></div>
          <p className="auth-art-heading">A world of <em>stories.</em></p>
          <div className="auth-map" aria-hidden="true">
            <span className="orbit orbit-back" /><span className="orbit orbit-side" />
            <Globe longitude={106} />
            {[2, 1, 0].map((index, slot) => <img key={index} className={"auth-pin auth-pin-" + slot} src={"/portraits/voice-" + index + ".jpg"} alt="" />)}
          </div>
          <a className="auth-excerpt" href={"/#story/" + voice.id}>
            <blockquote>“{voice.quote}”</blockquote>
            <span><MapPin size={14} />{voice.name} · {voice.place}</span>
          </a>
        </aside>
        <section className="auth-desk" aria-labelledby="auth-heading">
          <div className="auth-form-wrap">
            <h1 id="auth-heading">{signup ? <>Sign <em>up.</em></> : <>Log <em>in.</em></>}</h1>
            <p className="auth-demo-note">{forShare ? "Use sample details here. Publishing a story also uses your ChatGPT sign-in." : "Try the demo with a sample email and password."}</p>
            <form onSubmit={submit} method="post" noValidate>
              {fields.map(field => {
                const secret = field === "password" || field === "confirmation";
                const error = touched[field] && errors[field];
                const id = "auth-" + field;
                return <div className="auth-field" key={field}>
                  <label htmlFor={id}>{labels[field]}</label>
                  <div className="auth-input">
                    <input id={id} required disabled={busy}
                      type={secret ? (visible[field] ? "text" : "password") : field === "email" ? "email" : "text"}
                      autoComplete={secret ? (signup ? "new-password" : "current-password") : field === "email" ? "email" : "nickname"}
                      maxLength={field === "name" ? 55 : undefined}
                      placeholder={field === "email" ? "you@example.com" : field === "password" && signup ? "At least 8 characters" : undefined}
                      value={values[field]} aria-invalid={Boolean(error)} aria-describedby={error ? id + "-error" : undefined}
                      onBlur={() => setTouched(old => ({ ...old, [field]: true }))}
                      onChange={event => setValues({ ...values, [field]: event.target.value })} />
                    {secret && <button type="button" aria-label={(visible[field] ? "Hide " : "Show ") + (field === "confirmation" ? "password confirmation" : "password")}
                      aria-controls={id} onClick={() => setVisible(old => ({ ...old, [field]: !old[field] }))}>
                      {visible[field] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>}
                  </div>
                  <span className="auth-error" id={id + "-error"} aria-live="polite">{error || ""}</span>
                </div>;
              })}
              {issue && <p className="auth-error" role="alert">{issue}</p>}
              <button type="submit" className="btn dark auth-submit" disabled={busy}>{busy ? "Opening the atlas…" : signup ? "Sign up" : "Log in"}</button>
            </form>
            <p className="auth-switch">{signup ? "Already have an account?" : "New to RYE?"}{" "}
              <a href={(signup ? "/login" : "/signup") + (forShare ? "?next=share" : "")} className="text-link">{signup ? "Log in" : "Sign up"}</a>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
