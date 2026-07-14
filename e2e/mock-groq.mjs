// Minimal Groq (OpenAI-compatible) chat-completions stub so E2E runs are hermetic:
// the server is started with GROQ_BASE_URL=http://localhost:4010 and every AI call
// lands here instead of the real API. Only Postgres is real in an E2E run.
import http from 'node:http';

const TAILORED_PROFILE = {
  name: 'E2E Candidate',
  email: null,
  phone: null,
  location: 'Auckland, NZ',
  summary: 'Full-stack developer with TypeScript and React experience, tailored for this role.',
  skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  education: [
    { institution: 'University of Auckland', degree: 'BSc', field: 'Computer Science', startYear: 2021, endYear: 2024 },
  ],
  experience: [
    {
      company: 'Acme Corp',
      title: 'Software Engineer Intern',
      location: null,
      startDate: '2024-01',
      endDate: null,
      current: true,
      description: '• Built an internal tracking tool with TypeScript and React\n• Added Playwright end-to-end tests to CI',
    },
  ],
  certifications: [],
};

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let parsed = {};
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      // fall through with an empty body — treated as a plain-text request
    }
    const wantsJson = parsed.response_format?.type === 'json_object';
    const content = wantsJson
      ? JSON.stringify(TAILORED_PROFILE)
      : 'Dear Hiring Manager,\n\nThis is a stub cover letter from the E2E mock.\n\nSincerely,\nE2E Candidate';

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'stub-completion',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: parsed.model ?? 'stub',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    );
  });
});

server.listen(4010, () => console.log('mock-groq listening on :4010'));
