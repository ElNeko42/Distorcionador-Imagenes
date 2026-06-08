package com.imageeditor.controller;

import com.imageeditor.dto.AnalysisResponse;
import com.imageeditor.service.AiAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Objects;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ImageController {

    private final AiAnalysisService aiAnalysisService;

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AnalysisResponse> analyzeImage(@RequestParam("image") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String contentType = Objects.requireNonNullElse(file.getContentType(), "image/jpeg");
        if (!contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] imageBytes = file.getBytes();
            var labels = aiAnalysisService.analyzeImage(imageBytes, contentType);

            return ResponseEntity.ok(AnalysisResponse.builder()
                    .labels(labels)
                    .status("Se generaron " + labels.size() + " etiquetas correctamente")
                    .usedAi(aiAnalysisService.isConfigured())
                    .build());

        } catch (Exception e) {
            log.error("Error processing image analysis", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
