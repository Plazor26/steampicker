"use client";

import * as ort from "onnxruntime-web";

let session: ort.InferenceSession | null = null;
let meta: any = null;

export async function loadModel() {
  if (!session) {
    session = await ort.InferenceSession.create("/model/ann_recommender.onnx");
    const res = await fetch("/model/ann_meta.json");
    meta = await res.json();
  }
}

export async function scoreGame(features: number[]): Promise<number> {
  if (!session) throw new Error("Model not loaded");
  if (!meta) throw new Error("Meta not loaded");

  const input = new ort.Tensor("float32", Float32Array.from(features), [1, features.length]);
  const outputMap = await session.run({ input: input });
  const prob = outputMap[session.outputNames[0]].data[0] as number;
  return prob; // probability user likes this game
}
