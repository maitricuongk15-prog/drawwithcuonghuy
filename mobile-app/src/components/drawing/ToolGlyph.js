import React from 'react';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Path,
  Polygon as SvgPolygon,
  Rect as SvgRect,
  Text as SvgText,
} from 'react-native-svg';

export function ToolGlyph({ toolKey, color = '#111827' }) {
  if (toolKey === 'pencil') {
    return <MaterialIcons name="edit" size={18} color={color} />;
  }

  if (toolKey === 'brush') {
    return <MaterialIcons name="brush" size={18} color={color} />;
  }

  if (toolKey === 'eraser') {
    return <MaterialCommunityIcons name="eraser" size={18} color={color} />;
  }

  if (toolKey === 'text') {
    return <MaterialIcons name="text-fields" size={18} color={color} />;
  }

  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      {toolKey === 'line' && <SvgLine x1="3" y1="14" x2="15" y2="4" stroke={color} strokeWidth="1.8" />}
      {toolKey === 'rectangle' && (
        <SvgRect x="3.5" y="4" width="11" height="10" fill="none" stroke={color} strokeWidth="1.7" />
      )}
      {toolKey === 'circle' && <SvgCircle cx="9" cy="9" r="5.2" fill="none" stroke={color} strokeWidth="1.7" />}
      {toolKey === 'triangle' && (
        <SvgPolygon points="9,3.5 14.5,13.5 3.5,13.5" fill="none" stroke={color} strokeWidth="1.7" />
      )}
      {toolKey === 'diamond' && (
        <SvgPolygon points="9,3.2 14.8,9 9,14.8 3.2,9" fill="none" stroke={color} strokeWidth="1.7" />
      )}
      {toolKey === 'arrow' && (
        <>
          <SvgLine x1="3" y1="9" x2="14" y2="9" stroke={color} strokeWidth="1.8" />
          <SvgLine x1="10.5" y1="5.5" x2="14.5" y2="9" stroke={color} strokeWidth="1.8" />
          <SvgLine x1="10.5" y1="12.5" x2="14.5" y2="9" stroke={color} strokeWidth="1.8" />
        </>
      )}
    </Svg>
  );
}
