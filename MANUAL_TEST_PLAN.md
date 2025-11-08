# Manual Test Plan

This checklist exercises the printer photo workflow across web and native platforms using the normalized analysis payloads and mock helpers.

## Prerequisites
- Backend API running locally at `http://localhost:8000` (default stub mode is fine).
- Expo project dependencies installed (`cd app && npm install` if needed).
- Optional: Import `sampleAnalyzeResponse` from `app/src/__mocks__/sampleAnalyzeResponse` to preview UI states without network calls.

## Web (Expo Web) Flow
1. Start the web app: `cd app && npx expo start --web -c`.
2. Navigate to the Printer page and ensure a machine is selected or imported.
3. Click **Upload Photo** to open the file picker and choose a local image (`.jpg`/`.png`).
4. Verify the CTA flips to **Analyze**, tap it, and confirm the upload triggers a POST to `/api/analyze` and resolves without errors.
5. Verify the analysis drawer/modal shows:
   - The base image preview.
   - Heatmap overlay rendered from `localization.heatmap.data_url`.
   - Bounding boxes positioned correctly for each detected issue.
6. Check the predictions list for the top issues and confidences.
7. Review recommendations and capability notes for clarity.
8. Click **Export Slicer Diff** and ensure a Markdown file downloads containing the diff instructions.
9. (Optional) Copy values from the diff into your slicer profile to confirm they are readable and actionable.

## Native (Expo Go / Dev Client) Flow
1. Launch Metro for native testing: `cd app && npx expo start --lan -c` (use `--dev-client` if needed).
2. On a device or simulator, open the app via Expo Go or the dev client.
3. Navigate to the Printer page and select a machine.
4. Tap the **CameraButton** to launch the native image picker.
5. Capture or select a photo. Confirm the UI shows a loading indicator while uploading.
6. If offline, verify the image is queued and an alert indicates the analysis will retry later.
7. Once online, confirm queued items process automatically and trigger the analysis view.
8. Inspect the **AnalysisResult** screen:
   - Predictions and confidences render correctly.
   - Heatmap (if present) overlays the preview image.
   - Bounding boxes align with the detected regions.
   - Recommendations and capability notes display.
9. Use the Export action to copy or share the slicer diff (check clipboard/share sheet as appropriate for the platform).
10. Return to the History tab and ensure the new analysis entry appears with timestamp and top prediction.

## Mock Validation (Optional)
1. Import `sampleAnalyzeResponse` into a story/test or screen to render the AnalysisResult without performing a real upload.
2. Confirm all sections (predictions, overlays, recommendations, diff) render using the mock data.

Mark each step as completed before considering the feature ready for release.
