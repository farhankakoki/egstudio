import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const QUESTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    module: {
      type: Type.STRING,
      description:
        'Classify question into one of: "solids", "lines", "sections", "isometric", or "general".',
    },
    title: {
      type: Type.STRING,
      description: 'Short concise title summarizing the engineering graphics problem.',
    },
    summary: {
      type: Type.STRING,
      description:
        'Direct, clear answer summarizing the solution, computed results, inclinations, traces, or construction approach.',
    },
    givenData: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ['label', 'value'],
      },
      description: 'Extracted given quantities from the question.',
    },
    keyResults: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ['label', 'value'],
      },
      description: 'Calculated answers, apparent/true angles, traces, or geometric properties.',
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          instruction: { type: Type.STRING },
        },
        required: ['title', 'instruction'],
      },
      description: 'Ordered step-by-step drawing procedure following First-Angle KTU convention.',
    },
    solidsConfig: {
      type: Type.OBJECT,
      description: 'Populate when module is "solids". Omit otherwise.',
      properties: {
        solidType: {
          type: Type.STRING,
          description:
            'One of: triangular_prism, square_prism, pentagonal_prism, hexagonal_prism, cube, triangular_pyramid, square_pyramid, pentagonal_pyramid, hexagonal_pyramid, cylinder, cone, hemisphere.',
        },
        sideLength: { type: Type.NUMBER },
        baseWidth: { type: Type.NUMBER },
        rectangularBase: { type: Type.BOOLEAN },
        baseRadius: { type: Type.NUMBER },
        axisLength: { type: Type.NUMBER },
        numSides: { type: Type.NUMBER },
        restingCondition: {
          type: Type.STRING,
          description:
            'One of: base_hp, base_vp, base_edge_hp, base_corner_hp, face_hp, generator_hp, free.',
        },
        inclinedElement: {
          type: Type.STRING,
          description: 'One of: axis, slant_edge, body_diagonal.',
        },
        vpAngleType: {
          type: Type.STRING,
          description:
            'One of: true (true angle of axis/element to VP), apparent (top view angle to VP), resting_edge (angle of resting base edge on HP to VP).',
        },
        alphaHP: { type: Type.NUMBER },
        betaVP: { type: Type.NUMBER },
        leanDirectionX: {
          type: Type.STRING,
          description: 'positive (right) or negative (left)',
        },
        leanDirectionY: {
          type: Type.STRING,
          description: 'positive (away from VP) or negative (toward VP)',
        },
        inFrontOfVP: { type: Type.NUMBER },
      },
      required: [
        'solidType',
        'sideLength',
        'baseWidth',
        'rectangularBase',
        'baseRadius',
        'axisLength',
        'numSides',
        'restingCondition',
        'inclinedElement',
        'vpAngleType',
        'alphaHP',
        'betaVP',
        'leanDirectionX',
        'leanDirectionY',
        'inFrontOfVP',
      ],
    },
    linesConfig: {
      type: Type.OBJECT,
      description: 'Populate when module is "lines". Omit otherwise.',
      properties: {
        startLabel: { type: Type.STRING },
        endLabel: { type: Type.STRING },
        inputMode: {
          type: Type.STRING,
          description: '"angles" when true inclinations theta/phi are given, or "views" when planLength/elevLength are given.',
        },
        trueLength: { type: Type.NUMBER },
        startAboveHP: { type: Type.NUMBER },
        startInFrontVP: { type: Type.NUMBER },
        thetaHP: { type: Type.NUMBER },
        phiVP: { type: Type.NUMBER },
        planLength: { type: Type.NUMBER },
        elevLength: { type: Type.NUMBER },
        leanRight: { type: Type.BOOLEAN },
        leanForward: { type: Type.BOOLEAN },
        leanUp: { type: Type.BOOLEAN },
      },
      required: [
        'startLabel',
        'endLabel',
        'inputMode',
        'trueLength',
        'startAboveHP',
        'startInFrontVP',
        'thetaHP',
        'phiVP',
        'planLength',
        'elevLength',
        'leanRight',
        'leanForward',
        'leanUp',
      ],
    },
    sectionsConfig: {
      type: Type.OBJECT,
      description: 'Populate when module is "sections". Omit otherwise.',
      properties: {
        solidType: { type: Type.STRING },
        sideLength: { type: Type.NUMBER },
        baseRadius: { type: Type.NUMBER },
        axisLength: { type: Type.NUMBER },
        baseEdgeOrientation: {
          type: Type.STRING,
          description: 'edge_perp_vp, edge_parallel_vp, or edge_45_vp',
        },
        inFrontOfVP: { type: Type.NUMBER },
        planeMode: {
          type: Type.STRING,
          description: 'angle_height or through_body_diagonal',
        },
        sectionAngleDeg: { type: Type.NUMBER },
        sectionHeightAtAxis: { type: Type.NUMBER },
        keepPortion: {
          type: Type.STRING,
          description: 'bottom or top',
        },
      },
      required: [
        'solidType',
        'sideLength',
        'baseRadius',
        'axisLength',
        'baseEdgeOrientation',
        'inFrontOfVP',
        'planeMode',
        'sectionAngleDeg',
        'sectionHeightAtAxis',
        'keepPortion',
      ],
    },
    isometricConfig: {
      type: Type.OBJECT,
      description: 'Populate when module is "isometric". Omit otherwise.',
      properties: {
        scaleMode: {
          type: Type.STRING,
          description: '"view" for Isometric View (1:1) or "projection" for Isometric Projection (0.816x).',
        },
        hasTopSolid: { type: Type.BOOLEAN },
        bottomType: { type: Type.STRING },
        bottomSideOrRadius: { type: Type.NUMBER },
        bottomSecondaryWidth: { type: Type.NUMBER },
        bottomHeight: { type: Type.NUMBER },
        topType: { type: Type.STRING },
        topSideOrRadius: { type: Type.NUMBER },
        topSecondaryWidth: { type: Type.NUMBER },
        topHeight: { type: Type.NUMBER },
      },
      required: [
        'scaleMode',
        'hasTopSolid',
        'bottomType',
        'bottomSideOrRadius',
        'bottomSecondaryWidth',
        'bottomHeight',
        'topType',
        'topSideOrRadius',
        'topSecondaryWidth',
        'topHeight',
      ],
    },
  },
  required: ['module', 'title', 'summary', 'givenData', 'keyResults', 'steps'],
};

const SYSTEM_INSTRUCTION = `You are a senior B.Tech Engineering Graphics (KTU Syllabus, First-Angle Projection) professor and CAD solver.
A student has typed an Engineering Graphics question. Answer it directly, accurately, and step-by-step, AND extract exact parametric configuration for the matching simulator module when applicable:

1. Module Classification:
- "lines": Straight line projections, true/apparent lengths, true/apparent inclinations, traces (HT, VT).
- "solids": Projections of prisms, pyramids, cubes, cylinders, cones, or hemispheres resting on HP/VP (base, edge, corner, face, generator) and inclined to HP and/or VP.
- "sections": Sectioned solids, sectional top/front views, true shape of section, or lateral surface development.
- "isometric": Isometric view or isometric projection of a single solid or centered combination of two solids (e.g., pyramid on hemisphere, cylinder on square plate).
- "general": Conceptual/theory questions or anything outside the 4 parametric modules.

2. Critical KTU Geometric Extraction Rules:
- Always convert diameters to radius for curved solids (e.g. "diameter 50 mm" -> baseRadius = 25, or sideOrRadius = 25 for cylinder/cone/hemisphere).
- For "cube", sideLength = baseWidth = axisLength = cube edge length, numSides = 4, rectangularBase = false.
- For "hemisphere", axisLength = baseRadius = height = radius.
- For "solids":
  - When resting on a base edge on HP ("restingCondition": "base_edge_hp") and a VP angle is given:
    - If the resting base edge itself is inclined at an angle to VP (or if axis angle to HP + VP angle > 90°, e.g., "resting on an edge of base on HP, inclined at 40° to VP, axis inclined at 60° to HP"), set "vpAngleType": "resting_edge", "alphaHP": 60, "betaVP": 40.
    - If the question explicitly says "top view of axis is inclined at X° to VP", set "vpAngleType": "apparent" and "betaVP": X.
    - Otherwise use "vpAngleType": "true".
  - When a cube rests on a corner on HP and its "body diagonal is perpendicular to VP", set "solidType": "cube", "restingCondition": "base_corner_hp", "inclinedElement": "body_diagonal", "vpAngleType": "true", "alphaHP": 0, "betaVP": 90.
  - When a pyramid/prism rests on a corner on HP and its slant/longer edge is inclined to HP/VP, set "inclinedElement": "slant_edge".
  - When apex is "away from VP" -> "leanDirectionY": "positive"; "towards VP" -> "negative". "towards right" -> "leanDirectionX": "positive"; "left" -> "negative".
  - Default "inFrontOfVP": 25 if unspecified.
- For "sections":
  - If cut passes through midpoint of axis -> sectionHeightAtAxis = axisLength / 2.
  - If cut passes through a body diagonal -> planeMode = "through_body_diagonal", sectionAngleDeg = atan2(axisLength, baseDiagonal) in degrees.
  - If top portion is removed -> keepPortion = "bottom".
- For "isometric":
  - "isometric view" -> scaleMode = "view"; "isometric projection" -> scaleMode = "projection".
  - Put the bottom/base solid in bottomType/bottomSideOrRadius/bottomSecondaryWidth/bottomHeight and upper solid in topType/topSideOrRadius/topSecondaryWidth/topHeight with hasTopSolid = true.
- Keep the direct written answer concise and exam-focused (1-2 sentence summary, 3-5 short clear steps). Only populate the single config object matching the detected module and omit the other three.`;

async function callGeminiWithRetry(ai: GoogleGenAI, question: string) {
  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: question,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: QUESTION_RESPONSE_SCHEMA,
        },
      });
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (attempt < maxAttempts && (status === 429 || (status !== undefined && status >= 500))) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/solve-question', async (req, res) => {
    const rawQuestion = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!rawQuestion) {
      res.status(400).json({ error: 'Please type an Engineering Graphics question first.' });
      return;
    }
    if (rawQuestion.length > 3000) {
      res.status(400).json({ error: 'Question text is too long (maximum 3000 characters).' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please set GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const response = await callGeminiWithRetry(ai, rawQuestion);
      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'AI returned an empty response. Please try again.' });
        return;
      }
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 500;
      const message =
        err instanceof Error ? err.message : 'Failed to solve the question with Gemini AI.';
      if (status === 403 || message.includes('API_KEY_INVALID') || status === 400) {
        res.status(status).json({
          error:
            'Unable to authenticate with Gemini AI. Please verify your API key in Settings > Secrets.',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'AI request rate limit reached. Please wait a moment and try again.',
        });
        return;
      }
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EG Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EG Studio server:', err);
  process.exit(1);
});
