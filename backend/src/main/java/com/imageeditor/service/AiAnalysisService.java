package com.imageeditor.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.imageeditor.dto.LabelDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAnalysisService {

    @Value("${openrouter.api.key:}")
    private String apiKey;

    @Value("${openrouter.api.url}")
    private String apiUrl;

    @Value("${openrouter.model}")
    private String model;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public List<LabelDto> analyzeImage(byte[] imageBytes, String mediaType) {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("No OpenRouter API key configured, returning mock labels");
            return getMockLabels();
        }

        try {
            return callOpenRouterVision(imageBytes, mediaType);
        } catch (Exception e) {
            log.error("AI analysis failed, falling back to mock labels", e);
            return getMockLabels();
        }
    }

    private List<LabelDto> callOpenRouterVision(byte[] imageBytes, String mediaType) throws Exception {
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        String dataUri = "data:" + mediaType + ";base64," + base64Image;

        String prompt = """
                Analyze this image carefully. Identify 15-20 distinct visual elements, textures,
                characteristics, or descriptive attributes present in the image.

                For each element provide:
                - text: a short label (1-3 words, ALL CAPS)
                - count: a number with optional "+" suffix (e.g. "1", "16+", "3+")
                - x: approximate horizontal position as percentage 0-100
                - y: approximate vertical position as percentage 0-100

                Return ONLY a valid JSON array, no other text:
                [{"text":"LABEL","count":"5+","x":25,"y":30}, ...]
                """;

        Map<String, Object> textContent = Map.of("type", "text", "text", prompt);

        Map<String, Object> imageContent = Map.of(
                "type", "image_url",
                "image_url", Map.of("url", dataUri)
        );

        Map<String, Object> message = Map.of(
                "role", "user",
                "content", List.of(textContent, imageContent)
        );

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "max_tokens", 1024,
                "messages", List.of(message)
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        RestTemplate restTemplate = new RestTemplate();
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);

        JsonNode root = objectMapper.readTree(response.getBody());
        String content = root.path("choices").get(0).path("message").path("content").asText();

        // Strip markdown code blocks if present
        content = content.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();

        JsonNode labelsArray = objectMapper.readTree(content);
        List<LabelDto> labels = new ArrayList<>();
        for (JsonNode node : labelsArray) {
            labels.add(LabelDto.builder()
                    .text(node.path("text").asText())
                    .count(node.path("count").asText())
                    .x(node.path("x").asDouble())
                    .y(node.path("y").asDouble())
                    .build());
        }
        return labels;
    }

    private List<LabelDto> getMockLabels() {
        return List.of(
                LabelDto.builder().text("TEXTURA").count("1").x(10).y(10).build(),
                LabelDto.builder().text("FORMA").count("3+").x(30).y(8).build(),
                LabelDto.builder().text("COLOR").count("7+").x(60).y(12).build(),
                LabelDto.builder().text("BORDE").count("12+").x(80).y(10).build(),
                LabelDto.builder().text("LUZ").count("2").x(15).y(30).build(),
                LabelDto.builder().text("SOMBRA").count("4+").x(40).y(28).build(),
                LabelDto.builder().text("PATRÓN").count("9+").x(70).y(32).build(),
                LabelDto.builder().text("DETALLE").count("1").x(85).y(28).build(),
                LabelDto.builder().text("CONTORNO").count("6+").x(5).y(50).build(),
                LabelDto.builder().text("PROFUNDIDAD").count("2+").x(35).y(48).build(),
                LabelDto.builder().text("SUPERFICIE").count("11+").x(65).y(52).build(),
                LabelDto.builder().text("VOLUMEN").count("3").x(88).y(50).build(),
                LabelDto.builder().text("REFLEJO").count("5+").x(12).y(70).build(),
                LabelDto.builder().text("CONTRASTE").count("8+").x(38).y(68).build(),
                LabelDto.builder().text("SATURACIÓN").count("1").x(62).y(72).build(),
                LabelDto.builder().text("NITIDEZ").count("14+").x(80).y(68).build(),
                LabelDto.builder().text("GRANULADO").count("2").x(20).y(85).build(),
                LabelDto.builder().text("COMPOSICIÓN").count("6+").x(50).y(88).build(),
                LabelDto.builder().text("FOCO").count("3+").x(75).y(83).build(),
                LabelDto.builder().text("BALANCE").count("1").x(45).y(95).build()
        );
    }
}
