// Minimal Groq (OpenAI-compatible) chat-completions stub so E2E runs are hermetic:
// the server is started with GROQ_BASE_URL=http://localhost:4010 and every AI call
// lands here instead of the real API. Only Postgres is real in an E2E run.
import http from 'node:http';

const TAILORED_PROFILE = {
  name: 'Alex Chen',
  email: null,
  phone: null,
  location: 'Auckland, NZ',
  summary: 'Full-stack developer with TypeScript and React experience, tailored for this role.',
  skills: ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Playwright'],
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
  certifications: [{ name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', year: 2026 }],
};

// Shape returned for the match-analysis prompt (used by the screenshot pipeline and any
// future analyze-flow E2E). Content is deliberately realistic so screenshots look real.
const MATCH_ANALYSIS = {
  score: 78,
  summary:
    'A strong graduate-level fit: the core TypeScript/React/Node.js stack lines up directly with the role, backed by a deployed full-stack project with CI and tests. The main gaps are cloud infrastructure depth and container orchestration, both learnable on the job.',
  matched: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'REST APIs', 'Jest', 'CI/CD'],
  missing: ['Kubernetes', 'AWS CDK', 'GraphQL'],
  strengths: [
    {
      title: 'Directly relevant full-stack TypeScript experience',
      detail:
        'The resume shows an end-to-end TypeScript project — Next.js frontend, Express API, PostgreSQL — which maps one-to-one onto the advertised stack. The JD asks for “production experience with React and Node.js”, and the deployed tracker with real users demonstrates exactly that.',
    },
    {
      title: 'Testing culture beyond the graduate norm',
      detail:
        'Three test layers (unit, integration against a real database, Playwright E2E) wired into GitHub Actions match the JD’s emphasis on “engineers who own quality”. Few graduate CVs demonstrate a hermetic E2E suite.',
    },
    {
      title: 'Evidence of real debugging depth',
      detail:
        'The documented production auth investigation (cross-site cookies, response-shape mismatch, token-rotation race) speaks to the JD’s requirement to “debug complex issues across the stack”.',
    },
  ],
  gaps: [
    {
      title: 'No demonstrated Kubernetes experience',
      detail:
        'The JD lists container orchestration as a plus. The resume shows Docker builds but no cluster deployment; worth addressing with a small k8s deployment or acknowledging directly in interview.',
    },
    {
      title: 'Cloud infrastructure is consumption-level',
      detail:
        'S3 and managed Postgres are used well, but the JD hints at infrastructure-as-code (AWS CDK). No IaC appears on the resume.',
    },
  ],
  suggestions: [
    {
      title: 'Quantify the CI turnaround story',
      detail:
        'The pipeline resurrection (19 consecutive failures to consistently green) is impressive — put the numbers in the first bullet, as the JD team explicitly values CI ownership.',
    },
    {
      title: 'Surface PostgreSQL schema design earlier',
      detail:
        'The JD mentions data modelling twice. Move the 12-table Prisma schema with cascade rules and status machines above the deployment details.',
    },
  ],
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
    const prompt = parsed.messages?.[0]?.content ?? '';
    const wantsJson = parsed.response_format?.type === 'json_object';
    // Route by prompt marker — each ai.service prompt has a distinctive opening line.
    let jsonPayload = TAILORED_PROFILE;
    if (prompt.includes('expert technical recruiter')) jsonPayload = MATCH_ANALYSIS;
    else if (prompt.includes('aggregating a candidate')) jsonPayload = { matches: [] };
    else if (prompt.includes('senior technical interviewer')) {
      jsonPayload = {
        questions: [
          { question: 'Walk me through how your refresh-token rotation works and why you hash the stored token.', category: 'technical', tips: 'Cover the rotation-revocation flow and what an attacker gains without hashing.' },
          { question: 'Tell me about a time you debugged an issue that had more than one root cause.', category: 'behavioral', tips: 'The production auth saga is the obvious story — structure it symptom → elimination → evidence.' },
          { question: 'Why do you want to work here, and what would you build in your first 90 days?', category: 'company', tips: 'Tie the answer to the team’s product and your tracker’s AI pipeline experience.' },
        ],
      };
    }
    const content = wantsJson
      ? JSON.stringify(jsonPayload)
      : 'Dear Hiring Manager,\n\nI am writing to apply for the Graduate Software Engineer role. My experience building and deploying a full-stack TypeScript application — with JWT authentication, an AI resume pipeline, and a three-layer test suite wired into CI — maps directly onto the skills your team is looking for.\n\nIn my most recent project I diagnosed and fixed a production authentication failure that turned out to be three stacked bugs, verified each fix with HTTP-level probes, and pinned the regression with end-to-end tests. I would bring the same evidence-first approach to your codebase.\n\nI would welcome the chance to discuss the role further.\n\nSincerely,\nAlex Chen';

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
