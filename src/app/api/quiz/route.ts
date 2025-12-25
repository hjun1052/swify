import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import {
  QuizAnswer,
  QuizEvaluation,
  QuizQuestion,
} from "@/types/quiz";

interface VideoSummary {
  id: string;
  title: string;
  topic?: string | null;
  slides: { id: string; text: string }[];
}

interface QuizResponsePayload {
  questions: QuizQuestion[];
}

interface QuizEvaluationPayload {
  evaluation: QuizEvaluation;
}

const QUIZ_TOOL = {
  type: "function",
  function: {
    name: "create_quiz",
    description:
      "Create three reflective quiz questions that force judgment and nuanced reasoning rather than memorization.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description:
            "Exactly three questions mixing open reflection and multiple choice decisions.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: {
                type: "string",
                enum: ["multiple_choice", "open"],
              },
              prompt: { type: "string" },
              framingNote: {
                type: "string",
                description:
                  "Short context on what judgment or lens to apply.",
              },
              options: {
                type: "array",
                description:
                  "2-4 options for multiple choice that reflect different stances. Skip for open questions.",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["id", "label"],
                },
              },
            },
            required: ["id", "type", "prompt"],
          },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ["questions"],
    },
  },
} as const;

const FEEDBACK_TOOL = {
  type: "function",
  function: {
    name: "score_quiz",
    description:
      "Provide reflective feedback on the learner's answers. There is no right answer, but offer perspective.",
    parameters: {
      type: "object",
      properties: {
        evaluation: {
          type: "object",
          properties: {
            overallReflection: { type: "string" },
            questionFeedback: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  questionId: { type: "string" },
                  feedback: { type: "string" },
                  nudge: {
                    type: "string",
                    description:
                      "Optional suggestion that nudges the learner to explore a different angle.",
                  },
                },
                required: ["questionId", "feedback"],
              },
            },
          },
          required: ["overallReflection", "questionFeedback"],
        },
      },
      required: ["evaluation"],
    },
  },
} as const;

const QUIZ_MODEL = "gpt-4o-mini";

function summarizeVideo(video: VideoSummary) {
  const slideText = video.slides
    .map((slide, index) => `${index + 1}. ${slide.text}`)
    .join("\n");
  return `Title: ${video.title}
Topic hint: ${video.topic || "n/a"}

Slides:
${slideText}`;
}

function coerceQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const sanitized = questions.slice(0, 3).map((question, idx) => ({
    id: question.id || `q-${idx}`,
    type: question.type === "multiple_choice" ? "multiple_choice" : "open",
    prompt: question.prompt,
    framingNote: question.framingNote,
    options:
      question.type === "multiple_choice" && question.options
        ? question.options
            .filter((option) => option && option.id && option.label)
            .map((option, optionIdx) => ({
              id: option.id || `opt-${optionIdx}`,
              label: option.label,
              description: option.description,
            }))
        : undefined,
  }));

  while (sanitized.length < 3) {
    sanitized.push({
      id: `fallback-${sanitized.length}`,
      type: "open",
      prompt:
        "Share a thoughtful takeaway from the video and explain why it matters to you.",
    });
  }

  return sanitized;
}

async function requestQuiz(video: VideoSummary): Promise<QuizQuestion[]> {
  const summary = summarizeVideo(video);
  const completion = await openai.chat.completions.create({
    model: QUIZ_MODEL,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You design quick reflection quizzes for short-form explainers. Each question should demand a judgment call or perspective shift. There are no correct answers.",
      },
      {
        role: "user",
        content: `Create a 3-question quiz for the following content. Blend multiple-choice (2-4 thoughtful stances) and open reflection prompts. Avoid trivia or recall questions.

${summary}`,
      },
    ],
    tools: [QUIZ_TOOL],
    tool_choice: { type: "function", function: { name: "create_quiz" } },
  });

  const toolCall = completion.choices[0].message.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("Quiz generation failed");
  }

  const parsed = JSON.parse(toolCall.function.arguments) as QuizResponsePayload;
  return coerceQuizQuestions(parsed.questions);
}

async function requestEvaluation(params: {
  video: VideoSummary;
  quiz: QuizQuestion[];
  answers: QuizAnswer[];
}): Promise<QuizEvaluation> {
  const { video, quiz, answers } = params;
  const summary = summarizeVideo(video);
  const quizText = quiz
    .map((question) => {
      const base = `Question (${question.type}): ${question.prompt}`;
      if (question.type === "multiple_choice" && question.options) {
        const optionsText = question.options
          .map((opt) => `- ${opt.id}: ${opt.label}`)
          .join("\n");
        return `${base}\n${optionsText}`;
      }
      return base;
    })
    .join("\n\n");

  const answerText = answers
    .map(
      (answer) =>
        `Question ID: ${answer.questionId}\nResponse: ${answer.answer}${
          answer.reasoning ? `\nReasoning: ${answer.reasoning}` : ""
        }`
    )
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: QUIZ_MODEL,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "You are a reflective learning coach. Respond with encouragement, highlight trade-offs, and never mark answers as correct or incorrect.",
      },
      {
        role: "user",
        content: `Video summary:
${summary}

Quiz:
${quizText}

Learner answers:
${answerText}

Provide feedback referencing their reasoning.`,
      },
    ],
    tools: [FEEDBACK_TOOL],
    tool_choice: { type: "function", function: { name: "score_quiz" } },
  });

  const toolCall = completion.choices[0].message.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("Quiz evaluation failed");
  }

  const parsed = JSON.parse(toolCall.function.arguments) as QuizEvaluationPayload;
  return parsed.evaluation;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { video, answers, quiz } = body || {};

    if (
      !video ||
      !video.title ||
      !Array.isArray(video.slides) ||
      video.slides.length === 0
    ) {
      return NextResponse.json(
        { error: "Video context is required" },
        { status: 400 }
      );
    }

    const condensedVideo: VideoSummary = {
      id: video.id,
      title: video.title,
      topic: video.topic || video.suggestedNextQuery || "",
      slides: video.slides.map((slide: { id?: string; text: string }) => ({
        id: slide.id || crypto.randomUUID(),
        text: slide.text,
      })),
    };

    if (!answers) {
      const questions = await requestQuiz(condensedVideo);
      return NextResponse.json({ quiz: questions });
    }

    if (!Array.isArray(answers) || !Array.isArray(quiz)) {
      return NextResponse.json(
        { error: "Quiz definition and answers are required" },
        { status: 400 }
      );
    }

    const evaluation = await requestEvaluation({
      video: condensedVideo,
      quiz,
      answers,
    });

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error("[Quiz API] Failure", error);
    return NextResponse.json(
      { error: "Quiz service failed" },
      { status: 500 }
    );
  }
}
