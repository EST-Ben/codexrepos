#!/usr/bin/env node
"use strict";
// RESUME_MARKER: CHK_5
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_buffer_1 = require("node:buffer");
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const ROOT = node_path_1.default.resolve(__dirname, '..', '..');
const IMAGE_DIR = node_path_1.default.join(ROOT, 'sample_images');
const IMAGE_PATH = node_path_1.default.join(IMAGE_DIR, 'stringing.jpg');
const SAMPLE_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhIRExIVFhUVFRUVFRUVFRUVFRUVFRUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lICYtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAAFAAEDBAYCB//EAD8QAAIBAgQDBgQEBQMFAQAAAAECAAMRBBIhMQVBUQYiYXGBEzKRobHB0RQjQlJicuHwFyMzgpLxFSRTY3ODw9L/xAAZAQEAAwEBAAAAAAAAAAAAAAAAAgMEAQX/xAAkEQEAAgIBBAEFAAAAAAAAAAAAAQIRAyEEEjFBIlETFEKBsf/aAAwDAQACEQMRAD8A+lERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQE//Z';
function ensureSampleImage() {
    if (!node_fs_1.default.existsSync(IMAGE_PATH)) {
        node_fs_1.default.mkdirSync(IMAGE_DIR, { recursive: true });
        const buffer = node_buffer_1.Buffer.from(SAMPLE_BASE64, 'base64');
        node_fs_1.default.writeFileSync(IMAGE_PATH, buffer);
        console.log(`Wrote sample image to ${IMAGE_PATH}`);
    }
}
function buildMultipart(meta, image) {
    const boundary = `----codex-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    const newline = '\r\n';
    const parts = [];
    const boundaryLine = (closing = false) => node_buffer_1.Buffer.from(`--${boundary}${closing ? '--' : ''}${newline}`);
    parts.push(boundaryLine());
    parts.push(node_buffer_1.Buffer.from('Content-Disposition: form-data; name="image"; filename="stringing.jpg"' + newline));
    parts.push(node_buffer_1.Buffer.from('Content-Type: image/jpeg' + newline + newline));
    parts.push(image);
    parts.push(node_buffer_1.Buffer.from(newline));
    parts.push(boundaryLine());
    parts.push(node_buffer_1.Buffer.from('Content-Disposition: form-data; name="meta"' + newline + newline));
    parts.push(node_buffer_1.Buffer.from(meta));
    parts.push(node_buffer_1.Buffer.from(newline));
    parts.push(boundaryLine(true));
    const body = node_buffer_1.Buffer.concat(parts);
    return { body, boundary };
}
async function postMultipart(urlString, body, boundary) {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? node_https_1.default : node_http_1.default;
    const options = {
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
            const chunks = [];
            res.on('data', (chunk) => chunks.push(node_buffer_1.Buffer.from(chunk)));
            res.on('end', () => {
                const text = node_buffer_1.Buffer.concat(chunks).toString('utf8');
                resolve({ status: res.statusCode ?? 0, text });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
async function main() {
    ensureSampleImage();
    const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
    const endpoint = new URL('/api/analyze', apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`).toString();
    const meta = JSON.stringify({ machine_id: 'bambu_p1s', experience: 'Intermediate', material: 'PLA' });
    const imageBuffer = node_fs_1.default.readFileSync(IMAGE_PATH);
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
        }
        catch {
            console.log(response.text);
        }
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
void main();
