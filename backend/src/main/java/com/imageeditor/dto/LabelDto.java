package com.imageeditor.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LabelDto {
    private String text;
    private String count;
    private double x;   // percentage 0-100
    private double y;   // percentage 0-100
}
