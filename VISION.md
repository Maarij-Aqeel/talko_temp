# Smart Community Learning Platform – Vision & Roadmap
Turn the Heartbeat community into an intelligent learning system. Every member interaction — text comments, audio submissions, activity participation — is collected, analysed, and used to build rich learner profiles that power personalized reports and feed directly into the WordBuddy AI tutor app.

This is a platform-wide vision that applies across all community activities and tools. To drive consistent engagement, we will build AI-powered activities — including **Tuesday Talko**, **Pronunciation Coach**, and **Writing Feedback** — that give members structured, high-quality practice opportunities while generating the data needed to fuel personalised learning. Participation is tracked, gamified, and rewarded to keep members motivated and coming back.

The core belief:
The core belief: the best way to improve English is to encourage OUTPUT (speaking, writing). AI should not live our life for us — it should remove the pain of transitioning from INPUT learning to OUTPUT learning, so members actually practice and grow.

## Phase 1: Unified Data Collection

Build a central backend that captures all member activity across the community.

**Data sources to collect:**
- **Audio activities** — audio recordings, transcripts, AI feedback from speaking practice tools, including **Tuesday Talko** (weekly speaking prompt), **Pronunciation Coach** (phoneme-level AI feedback), and any future live session recordings
- **Writing activities** — written responses and AI feedback from **Writing Feedback** sessions and writing challenges
- **Text comments/posts** — use Heartbeat webhooks ("New Thread" trigger) to capture what members write in discussion channels
- **Other community activities** — vocabulary quizzes, embedded tool submissions, event RSVPs and attendance

**Participation automation:**
An automated script runs continuously to collect and analyse activity per member across all sources above. It tracks submission counts, response quality, streaks, and engagement trends — building the raw data layer that feeds Phases 2–4 and the gamification engine.

**What to store per activity:**
- Member ID (Heartbeat user ID, linked to email)
- Activity type (audio, text comment, quiz, etc.)
- Raw content (audio file in Storage, or text)
- AI analysis (grammar issues, vocabulary level, errors found)
- Activity/topic label (e.g. "Week 12 – Travel", "Writing Wednesday")
- Timestamp

**Tech:**
- Supabase Postgres: `member_activities` table (unified for all activity types)
- Supabase Storage: audio files bucket
- Heartbeat API webhooks → Vercel serverless endpoint to capture text posts automatically
- Embedded tools save directly via API after each submission

## Phase 2: Learner Profiles

Aggregate each member's activities into a living learner profile that grows over time.

**Profile data:**
- Participation stats: total activities, streaks, weekly frequency
- **Error pattern analysis** — recurring grammar issues across all text + audio (e.g. "articles", "tenses", "prepositions")
- **Vocabulary level tracking** — words they've used, native upgrades they've received, estimated active vocabulary size
- **Output confidence score** — how often they participate, average response length, complexity growth over time
- **Topics & interests** — which activities they engage with most, what subjects they talk/write about
- **Improvement timeline** — errors that appeared early but stopped recurring, vocabulary complexity trend

**Tech:** `member_profiles` table updated by a weekly Gemini batch job that reads recent activities and summarizes patterns. Profile is a living JSON document that grows richer over time.

## Phase 3: Weekly Personal Reports

Automatically generate and deliver personalized progress reports to each active member.

**Report contents:**
- Participation summary — "You practiced X times this week across Y activities"
- Top focus areas — recurring errors to work on, drawn from both text and audio
- Improvement highlights — things they used to get wrong but now get right
- Vocabulary growth — new words/idioms they've been exposed to
- Personal challenge — a mini-goal for next week (e.g. "Try using 'get the hang of' in your next speaking practice")

**Delivery options:**
- Heartbeat DM (their API supports direct messages)
- Email
- In-app notification in WordBuddy

**Tech:** Vercel Cron job (or Supabase Edge Function) runs weekly. For each active member: query recent activities → call Gemini to generate a personalized report → deliver via chosen channel.

## Phase 4: Community Gamification & Rewards

Use the participation data collected in Phase 1 to gamify the community and reward the most active members — turning consistent practice into a visible, motivating competition.

**Leaderboard:**
- A live community leaderboard ranks members by participation score (activity count, streak length, quality of submissions)
- Refreshed weekly; displayed inside Heartbeat and/or a dedicated web view
- Two leaderboard tracks: **Most Active** (total participation) and **Longest Streak** (consecutive weeks with at least one submission)

**Rewards:**
- Top 5 members on the leaderboard each month are rewarded with **free tickets to Speaking Workshop events**
- Rewards are announced publicly in the community to celebrate wins and inspire others
- Secondary rewards (badges, shoutouts, WordBuddy premium access) can be layered in over time

**Impact:**
- Directly boosts participation rates for AI-powered activities (Tuesday Talko, Pronunciation Coach, Writing Feedback)
- Creates a positive feedback loop: more participation → richer learner profiles → better personalisation → more motivation to participate
- Increases workshop event attendance and community retention

**Tech:** Supabase view or materialized table aggregates `member_activities` into ranked scores. A Vercel endpoint serves leaderboard data. Reward allocation is triggered automatically when monthly rankings are finalised, with admin confirmation before delivery.

## Phase 5: WordBuddy AI Tutor Integration

The most powerful payoff: use community learner profiles to create truly personalized learning in the WordBuddy app.

**How community data powers the app:**
- **Custom vocabulary lists** — auto-populate a member's library with words from their native upgrades, community discussions, and topics they engaged with. Words are tied to where they discovered them (e.g. "learned from Week 12 speaking practice"), which aids memorization.
- **AI Tutor personalization** — the AI tutor already guides users from word → phrase → sentence. With community data, it knows exactly which words the member struggles with, which grammar patterns to focus on, and what level to pitch guidance at.
- **Targeted OUTPUT practice** — if a member's profile shows they avoid past tense, the AI tutor can design speaking prompts that specifically encourage past tense usage. Remove the pain, guide the baby steps.
- **CEFR level estimation** — estimate and track each member's level from their actual output (not a test), and adjust dictionary complexity, exercise difficulty, and tutor guidance accordingly.
- **Spaced repetition** — feed idioms, phrasal verbs, and vocabulary from community feedback into an SRS system within the app.
- **Culture & context awareness** — the AI dictionary already explains words with cultural context. Community data reveals which contexts members actually need (work, travel, casual), so the tutor can prioritize relevant usage examples.

**Tech:** Shared Supabase database that both the community backend and WordBuddy app read from. Or an API endpoint that returns a member's profile + recommended study plan.

## Data Architecture

```
Heartbeat Community
  ├─ Text posts/comments ────┐
  ├─ Audio activities ────────┤
  └─ Other activities ───────┤
                              ▼
                   Supabase (central DB)
                   ├─ member_activities
                   ├─ member_profiles
                   └─ audio_storage
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      Weekly Reports    WordBuddy AI      Admin
      (Gemini + DM)     Tutor App       Dashboard
```

## Privacy & Consent

- Members opt-in before data is saved ("Save my practice to build my learning profile")
- Members can view and delete their data at any time
- Audio retention policy (e.g. 90 days, keep transcripts only after that)
- Clear communication: "We use your practice data to give you better, personalized learning"

## Priority Order

1. **Phase 1** (data collection + participation automation) — start saving community activities now; automate per-member tracking across all AI-powered activities.
2. **Phase 3** (weekly reports) — immediate member value, proves the concept, drives engagement.
3. **Phase 4** (gamification & rewards) — leaderboard and workshop ticket rewards to boost participation rates and community retention.
4. **Phase 2** (learner profiles) — build incrementally as data accumulates.
5. **Phase 5** (WordBuddy integration) — the long-term multiplier. Depends on app readiness but is the ultimate goal.
