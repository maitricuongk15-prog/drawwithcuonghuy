import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

export function BrushSizeSlider({ value, min = 1, max = 256, onChange, styles }) {
  const [trackWidth, setTrackWidth] = useState(1);
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : min;
  const clampedValue = Math.max(min, Math.min(max, safeValue));
  const ratio = (clampedValue - min) / Math.max(1, max - min);

  const updateFromLocation = useCallback(
    (locationX) => {
      const width = Math.max(1, trackWidth);
      const offset = Math.max(0, Math.min(width, Number(locationX) || 0));
      const next = Math.round(min + (offset / width) * (max - min));
      onChange?.(next);
    },
    [max, min, onChange, trackWidth]
  );

  return (
    <View style={styles.brushSliderWrap}>
      <View style={styles.brushSliderHeader}>
        <Text style={styles.brushSliderValue}>{clampedValue}px</Text>
        <Text style={styles.brushSliderHint}>max 256px</Text>
      </View>
      <View
        style={styles.brushSliderTrack}
        onLayout={(e) => {
          const width = Math.round(e.nativeEvent.layout.width || 0);
          if (width > 0) {
            setTrackWidth(width);
          }
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => updateFromLocation(e.nativeEvent.locationX)}
        onResponderMove={(e) => updateFromLocation(e.nativeEvent.locationX)}
      >
        <View style={[styles.brushSliderFill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.brushSliderThumb, { left: ratio * trackWidth - 8 }]} />
      </View>
    </View>
  );
}
