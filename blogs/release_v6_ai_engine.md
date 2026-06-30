# Announcing India Procurement Watch V6: The Darshi Intelligence Desk Upgrade

We are incredibly excited to announce the rollout of **India Procurement Watch V6**, bringing massive upgrades to the Darshi AI Intelligence Desk! Our goal has always been to make public procurement data transparent, accessible, and deeply analytical for journalists and researchers. 

With V6, we've entirely rewritten our AI pipeline to provide a conversational, investigative experience that rivals enterprise-grade tools.

Here’s what’s new:

## ⚡ True Real-Time Streaming (SSE)

Gone are the days of staring at a loading spinner for 30 seconds while the AI crunches millions of SQLite rows. We have re-architected the backend Python pipeline to utilize **Server-Sent Events (SSE)**. 

Now, when you ask Darshi a complex question like *"Find me all single-bid contracts over 1 crore"*, you will instantly see her "thinking out loud." Her reasoning process, SQL generation, and final narrative summary stream token-by-token directly into your browser. It’s fast, transparent, and beautiful.

## 📊 The Dynamic Visualizer Engine

Staring at massive spreadsheets can be exhausting. That's why we built the **Visualizer Engine** (Phase 4 of our ReAct pipeline). 

When Darshi executes a query, this high-speed sub-agent intercepts the raw data and evaluates its "shape". If it detects a trend or categorical distribution (like the Top 5 Winning Organizations), it instantly instructs your browser to render a beautiful, interactive **Chart.js Pie, Bar, or Line graph** right inside the chat bubble!

If you ask for an aggregate metric (like "Total value of all contracts"), it renders a sleek KPI Dashboard Card. 

*Security Note: Darshi operates in a strict Read-Only (`?mode=ro`) sandbox. She only visualizes data—she can never edit or manipulate the underlying database.*

## 🛡️ Auto-Rotational Model Fallbacks

API instability shouldn't break your investigation. V6 introduces a highly resilient **Auto-Rotational Fallback wrapper**. 

If our primary model (e.g., DeepSeek V4) hits a rate limit or times out, the backend instantly intercepts the error, suppresses the crash, and seamlessly redirects your exact prompt to a backup model (like GPT-4o or Gemini). You get zero downtime and a flawless chatting experience.

## 📄 Smart Data Export & Formatting

When dealing with massive tables (20+ rows), the chat interface used to become a cluttered mess of text. Not anymore!

1. **Smart Truncation**: Darshi now intelligently truncates large tables to show a preview of only the top 5 rows.
2. **Action Bar**: Below the preview, she generates two action buttons: `[ Export Full Markdown ]` and `[ Export Full PDF ]`.
3. **Instant Browser Generation**: Clicking these buttons uses your browser's local memory to instantly render the full dataset into a perfectly formatted `.md` or `.pdf` file. No server processing required!

We’ve also integrated **Markdown parsing** into the chat interface, meaning Darshi's summaries now feature clean headings, bold text, and bulleted lists.

---

**Upgrade to V6 today** by pulling the latest `main` branch, dropping your data into the `data_dump/` folder, and launching your local server. 

Happy investigating!
