#!/usr/bin/env node
// RESUME_MARKER: CHK_5
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import http from 'node:http';
import https from 'node:https';

const ROOT = path.resolve(__dirname, '..', '..');
const IMAGE_DIR = path.join(ROOT, 'sample_images');
const IMAGE_PATH = path.join(IMAGE_DIR, 'stringing.jpg');

const SAMPLE_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhIRExIVFhUVFRUVFRUVFRUVFRUVFRUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lICYtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAAFAAEDBAYCB//EAD8QAAIBAgQDBgQEBQMFAQAAAAECAAMRBBIhMQVBUQYiYXGBEzKRobHB0RQjQlJicuHwFyMzgpLxFSRTY3ODw9L/xAAZAQEAAwEBAAAAAAAAAAAAAAAAAgMEAQX/xAAkEQEAAgIBBAEFAAAAAAAAAAAAAQIRAyEEEjFBIlETFEKBsf/aAAwDAQACEQMRAD8A+lERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQE//Z';

function ensureSampleImage(): void {
  if (!fs.existsSync(IMAGE_PATH)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    const buffer = Buffer.from(SAMPLE_BASE64, 'base64');
    fs.writeFileSync(IMAGE_PATH, buffer);
    console.log(`Wrote sample image to ${IMAGE_PATH}`);
  }
}

function buildMultipart(meta: string, image: Buffer): { body: Buffer; boundary: string } {
  const boundary = `----codex-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const newline = '\r\n';
  const parts: Buffer[] = [];

  const boundaryLine = (closing = false) => Buffer.from(`--${boundary}${closing ? '--' : ''}${newline}`);

  parts.push(boundaryLine());
  parts.push(Buffer.from('Content-Disposition: form-data; name="image"; filename="stringing.jpg"' + newline));
  parts.push(Buffer.from('Content-Type: image/jpeg' + newline + newline));
  parts.push(image);
  parts.push(Buffer.from(newline));

  parts.push(boundaryLine());
  parts.push(Buffer.from('Content-Disposition: form-data; name="meta"' + newline + newline));
  parts.push(Buffer.from(meta));
  parts.push(Buffer.from(newline));

  parts.push(boundaryLine(true));

  const body = Buffer.concat(parts);
  return { body, boundary };
}

async function postMultipart(urlString: string, body: Buffer, boundary: string): Promise<{ status: number; text: string }> {
  const url = new URL(urlString);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  const options: https.RequestOptions = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 0, text });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main(): Promise<void> {
  ensureSampleImage();

  const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
  const endpoint = new URL('/api/analyze', apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`).toString();
  const meta = JSON.stringify({ machine_id: 'bambu_p1s', experience: 'Intermediate', material: 'PLA' });
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const { body, boundary } = buildMultipart(meta, imageBuffer);

  console.error(`Uploading sample analysis to ${apiUrl}`);
  try {
    const response = await postMultipart(endpoint, body, boundary);
    if (response.status < 200 || response.status >= 300) {
      console.error(`Request failed with status ${response.status}`);
      console.error(response.text);
      process.exitCode = 1;
      return;
    }
    try {
      const json = JSON.parse(response.text);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(response.text);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
