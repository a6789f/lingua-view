# Lingua View

Language X-Ray — AI Video Language Learning Prototype
Build a functional web application called Language X-Ray.
The purpose of the application is to let users upload a video and transform it into an interactive language-learning experience.
The core concept is similar to a streaming-service "X-Ray" feature, but instead of showing actor information, the application analyzes the dialogue linguistically.
1. Video Upload
Create a clean drag-and-drop video upload interface.
Supported formats:
MP4
WebM
MOV
After uploading, display the video in a modern video player.
For the prototype, the user should be able to upload a local video file and process it.
2. AI Video Analysis
After uploading the video:
Extract the audio.
Transcribe the dialogue using an AI speech-to-text service.
Generate accurate timestamps for dialogue segments.
Detect different speakers when possible.
Divide the transcript into individual dialogue sentences.
Store each sentence with:
speaker
original text
start timestamp
end timestamp
translated text
The architecture should make the AI provider replaceable.
Use OpenAI's transcription API for the initial implementation.
Do NOT send the entire video to a language model unnecessarily. Extract/process the audio and transcript efficiently.
3. Interactive Video Player
Create a three-part layout:
Center
Large video player.
Bottom
Current dialogue subtitle.
Display:
Original language: "Я не понимаю, что ты хочешь сказать."
Translation: "I don't understand what you mean."
Right sidebar
The Language X-Ray panel.
The sidebar should update automatically according to the current dialogue.
4. Language X-Ray
When the user pauses the video, identify the dialogue currently being spoken.
Display:
Original
The original sentence.
Translation
Natural translation into the user's selected language.
Word Analysis
Break the sentence into clickable words.
Example:
Я | не | понимаю | что | ты | хочешь | сказать
Clicking a word opens a small explanation containing:
meaning
dictionary/base form
pronunciation
grammatical role
relevant conjugation/declension
contextual meaning
example sentence
The explanation must prioritize the meaning of the word IN THIS SPECIFIC CONTEXT rather than simply giving a dictionary definition.
5. Sentence Explanation
Add a button:
"Explain this sentence"
The AI should explain:
sentence structure
grammar
important expressions
slang
idioms
tone
why this wording was used
literal meaning vs natural meaning
Keep explanations concise and understandable to a language learner.
6. Dialogue Mode
Add a button called:
"Dialogue"
When clicked, replace the Language X-Ray panel with the complete dialogue transcript.
Display the transcript as a conversation:
[12:31] Anna: Я не понимаю, что ты хочешь сказать.
[12:35] Ivan: Я просто пытаюсь тебе помочь.
Each dialogue line must be clickable.
Clicking a line seeks the video player to that exact timestamp.
Highlight the currently playing line automatically.
7. Translation
Allow the user to select:
Original language
Learning language
Translation language
For the first prototype, prioritize Russian → Arabic and Russian → English.
Every sentence should have an automatically generated translation.
Allow the user to toggle:
Original only
Translation only
Original + Translation
8. Learning Controls
Add:
Replay sentence
Replay current word
Slow playback
Save word
Save sentence
Show/hide translation
Show/hide word analysis
Add a "My Vocabulary" section where saved words appear.
Each saved word should contain:
word
translation
original sentence
timestamp
video reference
9. User Interface
The interface should feel like a modern premium streaming application rather than an educational website.
Dark cinematic interface.
Minimal UI.
Large video player.
Subtle animations.
The language-learning tools should appear as an intelligent layer over the video rather than dominating the screen.
The user should feel like they are watching a normal movie with an optional AI layer.
10. Important UX Behavior
The application must NOT pause the video every time it encounters a word.
Normal viewing should remain uninterrupted.
The user can pause at any time.
When paused:
Detect the current dialogue.
Show its transcript.
Show translation.
Show Language X-Ray.
Allow the user to inspect individual words.
The user can also enter a dedicated Learning Mode where the application pauses automatically after each dialogue sentence.
11. Processing Screen
While processing a video, show a progress interface:
Analyzing video → Extracting audio → Transcribing dialogue → Detecting speakers → Segmenting dialogue → Translating → Preparing Language X-Ray
Do not fake the processing.
The UI should reflect actual backend processing states.
12. Prototype Scope
Do NOT build:
social networking
payments
subscriptions
complex user profiles
mobile apps
recommendation algorithms
movie database
streaming catalog
This is an experimental prototype.
The main goal is to prove that:
VIDEO → TRANSCRIPT → TIMESTAMPS → TRANSLATION → LANGUAGE ANALYSIS → INTERACTIVE PLAYER
works as one coherent experience.
13. Architecture
Use a clean modular architecture.
Frontend: React + TypeScript.
Backend: Use a suitable server/API architecture capable of handling video uploads and AI processing.
Database: Use a simple database for projects, videos, transcript segments, vocabulary and user settings.
AI: Use OpenAI for transcription and language analysis.
Keep API keys server-side and NEVER expose them in frontend code.
Design the code so the AI provider can be replaced later.
14. Demo Experience
After the application is built, include a small sample/demo project so the interface can be tested without uploading a large video.
The demo should contain several Russian dialogue sentences with timestamps and translations.
The final result should feel like:
"Netflix X-Ray + interactive subtitles + AI language tutor"
rather than a conventional subtitle editor.
Prioritize a working end-to-end prototype over implementing every advanced feature.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/209448ad-a1c1-42ce-8efc-f8cd15e41658).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
