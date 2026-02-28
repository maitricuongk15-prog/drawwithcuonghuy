import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle as SvgCircle, G, Path, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import { BRUSH_SIZES, COLOR_PALETTE, TOOLS } from '../../constants/drawing';
import { getTextSelectionFrame } from '../../utils/exportPng';
import { BrushSizeSlider } from '../drawing/BrushSizeSlider';
import { ToolGlyph } from '../drawing/ToolGlyph';

function ActionGlyph({ type, color = '#111827' }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 18 18">
      {type === 'undo' && (
        <>
          <Path d="M7.3 4.2 L3.2 8.3 L7.3 12.4" fill="none" stroke={color} strokeWidth="1.7" />
          <Path d="M3.6 8.3 H10.1 C13 8.3 14.9 10 14.9 12.8" fill="none" stroke={color} strokeWidth="1.7" />
        </>
      )}
      {type === 'redo' && (
        <>
          <Path d="M10.7 4.2 L14.8 8.3 L10.7 12.4" fill="none" stroke={color} strokeWidth="1.7" />
          <Path d="M14.4 8.3 H7.9 C5 8.3 3.1 10 3.1 12.8" fill="none" stroke={color} strokeWidth="1.7" />
        </>
      )}
      {type === 'save' && (
        <>
          <SvgRect x="3.1" y="2.2" width="11.8" height="13.6" rx="1.4" fill="none" stroke={color} strokeWidth="1.6" />
          <SvgRect x="5.1" y="3.8" width="5.2" height="3.1" fill={color} />
          <SvgRect x="5.2" y="10.2" width="6.6" height="3.7" fill="none" stroke={color} strokeWidth="1.4" />
        </>
      )}
    </Svg>
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function parseColorToRgba(color) {
  const source = String(color || '').trim();

  const rgbaMatch = source.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((item) => item.trim());
    const r = clamp(parts[0], 0, 255);
    const g = clamp(parts[1], 0, 255);
    const b = clamp(parts[2], 0, 255);
    const a = parts.length >= 4 ? clamp(parts[3], 0, 1) : 1;
    return { r, g, b, a };
  }

  const hex = source.replace('#', '');
  if (/^[\da-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  if (/^[\da-f]{8}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: Number((parseInt(hex.slice(6, 8), 16) / 255).toFixed(2)),
    };
  }
  if (/^[\da-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(`${hex[0]}${hex[0]}`, 16),
      g: parseInt(`${hex[1]}${hex[1]}`, 16),
      b: parseInt(`${hex[2]}${hex[2]}`, 16),
      a: 1,
    };
  }
  if (/^[\da-f]{4}$/i.test(hex)) {
    return {
      r: parseInt(`${hex[0]}${hex[0]}`, 16),
      g: parseInt(`${hex[1]}${hex[1]}`, 16),
      b: parseInt(`${hex[2]}${hex[2]}`, 16),
      a: Number((parseInt(`${hex[3]}${hex[3]}`, 16) / 255).toFixed(2)),
    };
  }

  return { r: 0, g: 0, b: 255, a: 1 };
}

function rgbaToColorText({ r, g, b, a }) {
  const safeR = Math.round(clamp(r, 0, 255));
  const safeG = Math.round(clamp(g, 0, 255));
  const safeB = Math.round(clamp(b, 0, 255));
  const safeA = Number(clamp(a, 0, 1).toFixed(2));
  return `rgba(${safeR}, ${safeG}, ${safeB}, ${safeA})`;
}

function RgbaChannelSlider({
  label,
  value,
  min,
  max,
  onChange,
  trackColor = '#3b82f6',
  valueText,
  styles,
}) {
  const [trackWidth, setTrackWidth] = useState(1);
  const clamped = clamp(value, min, max);
  const ratio = (clamped - min) / Math.max(1, max - min);

  const updateFromLocation = useCallback(
    (locationX) => {
      const width = Math.max(1, trackWidth);
      const offset = Math.max(0, Math.min(width, Number(locationX) || 0));
      const next = min + (offset / width) * (max - min);
      onChange?.(next);
    },
    [max, min, onChange, trackWidth]
  );

  return (
    <View style={styles.rgbaRow}>
      <Text style={styles.rgbaLabel}>{label}</Text>
      <View
        style={styles.rgbaTrack}
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
        <View style={[styles.rgbaFill, { width: `${ratio * 100}%`, backgroundColor: trackColor }]} />
        <View style={[styles.rgbaThumb, { left: ratio * trackWidth - 7, borderColor: trackColor }]} />
      </View>
      <Text style={styles.rgbaValue}>{valueText || Math.round(clamped)}</Text>
    </View>
  );
}

export function DrawingScreen({ auth, drawing, styles, canvasContainerRef, onExportPng }) {
  const { width, height } = useWindowDimensions();
  const isPhoneLayout = width <= 932;
  const isLandscape = width >= height;
  const shouldShowToggle = isPhoneLayout;
  const shouldSuggestLandscape = isPhoneLayout && !isLandscape;
  const basicTools = useMemo(() => TOOLS.filter((tool) => tool.group === 'tool'), []);
  const shapeTools = useMemo(() => TOOLS.filter((tool) => tool.group === 'shape'), []);
  const visibleStrokeCount = useMemo(
    () => drawing.paths.filter((entry) => Boolean(entry?.path) || entry?.kind === 'dot').length,
    [drawing.paths]
  );
  const activeStrokeProfile = drawing.getActiveStrokeProfile();
  const [showRgbaPicker, setShowRgbaPicker] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(() => !isPhoneLayout);
  const [rgbaDraft, setRgbaDraft] = useState(() => parseColorToRgba(drawing.color));
  const [canvasLayout, setCanvasLayout] = useState({ width: 1, height: 1 });
  const ToolbarContainer = shouldShowToggle ? ScrollView : View;
  const toolbarContainerStyle = shouldShowToggle
    ? [styles.toolbar, styles.toolbarMobile]
    : [styles.toolbar, styles.toolbarContent];
  const toolbarContainerProps = shouldShowToggle
    ? {
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        contentContainerStyle: [styles.toolbarContent, styles.toolbarContentMobile],
      }
    : {};

  useEffect(() => {
    setRgbaDraft(parseColorToRgba(drawing.color));
  }, [drawing.color]);

  useEffect(() => {
    if (!shouldShowToggle) {
      setToolbarVisible(true);
      return;
    }
    if (!isLandscape) {
      setToolbarVisible(true);
    }
  }, [isLandscape, shouldShowToggle]);

  const updateChannel = useCallback(
    (channel, value) => {
      setRgbaDraft((prev) => {
        const next = {
          ...prev,
          [channel]: channel === 'a' ? Number(clamp(value, 0, 1).toFixed(2)) : Math.round(clamp(value, 0, 255)),
        };
        drawing.setColor(rgbaToColorText(next));
        return next;
      });
    },
    [drawing]
  );

  const handleCanvasLayout = useCallback(
    (event) => {
      const widthValue = Number(event?.nativeEvent?.layout?.width) || 1;
      const heightValue = Number(event?.nativeEvent?.layout?.height) || 1;
      const safeWidth = Math.max(1, widthValue);
      const safeHeight = Math.max(1, heightValue);
      setCanvasLayout((prev) => {
        if (Math.abs(prev.width - safeWidth) < 0.5 && Math.abs(prev.height - safeHeight) < 0.5) {
          return prev;
        }
        return { width: safeWidth, height: safeHeight };
      });
      drawing.setCanvasSize?.({ width: safeWidth, height: safeHeight });
    },
    [drawing]
  );

  const getEntryScale = useCallback(
    (entry) => {
      const sourceWidth = Number(entry?.canvasWidth);
      const sourceHeight = Number(entry?.canvasHeight);
      if (!Number.isFinite(sourceWidth) || sourceWidth <= 0 || !Number.isFinite(sourceHeight) || sourceHeight <= 0) {
        return { scaleX: 1, scaleY: 1 };
      }
      return {
        scaleX: canvasLayout.width / sourceWidth,
        scaleY: canvasLayout.height / sourceHeight,
      };
    },
    [canvasLayout.height, canvasLayout.width]
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {(!shouldShowToggle || toolbarVisible) && (
      <ToolbarContainer
        style={toolbarContainerStyle}
        {...toolbarContainerProps}
      >
        <View style={styles.toolbarSection}>
          <Text style={styles.sectionLabel}>Project</Text>
          <Text style={styles.projectTag}>{drawing.currentProject.name}</Text>
          <Text style={styles.projectInviteCode}>Invite: {drawing.currentProject?.shareToken || '--'}</Text>
          <View style={styles.sessionActions}>
            <TouchableOpacity style={styles.sessionButton} onPress={drawing.leaveProject}>
              <Text style={styles.sessionButtonText}>Projects</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sessionButton} onPress={auth.handleLogout}>
              <Text style={styles.sessionButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.toolbarSection}>
          <Text style={styles.sectionLabel}>Tools</Text>
          <View style={styles.toolsGrid}>
            {basicTools.map((tool) => (
              <TouchableOpacity
                key={tool.key}
                style={[styles.toolButton, drawing.drawingMode === tool.key && styles.toolButtonActive]}
                onPress={() => drawing.setDrawingMode(tool.key)}
              >
                <ToolGlyph toolKey={tool.key} color={drawing.drawingMode === tool.key ? '#0f172a' : '#334155'} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.toolbarSection}>
          <Text style={styles.sectionLabel}>Brushes</Text>
          <View style={styles.brushPanel}>
            <BrushSizeSlider value={drawing.strokeWidth} min={1} max={256} onChange={drawing.setStrokeWidth} styles={styles} />
            <View style={styles.brushesGrid}>
              {BRUSH_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.brushButton, drawing.strokeWidth === size && styles.brushButtonActive]}
                  onPress={() => drawing.setStrokeWidth(size)}
                >
                  <View style={[styles.brushDot, { width: size * 3, height: size * 3 }]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.toolbarSection}>
          <Text style={styles.sectionLabel}>Shapes</Text>
          <View style={styles.shapesGrid}>
            {shapeTools.map((tool) => (
              <TouchableOpacity
                key={tool.key}
                style={[styles.toolButton, drawing.drawingMode === tool.key && styles.toolButtonActive]}
                onPress={() => drawing.setDrawingMode(tool.key)}
              >
                <ToolGlyph toolKey={tool.key} color={drawing.drawingMode === tool.key ? '#0f172a' : '#334155'} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.toolbarSection}>
          <Text style={styles.sectionLabel}>Colors</Text>
          <View style={styles.colorsSectionWrap}>
            <View style={styles.colorsContainer}>
              <View style={styles.colorsPalette}>
                {COLOR_PALETTE.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.colorRow}>
                    {row.map((entry) => (
                      <TouchableOpacity
                        key={entry}
                        style={[
                          styles.colorButton,
                          { backgroundColor: entry },
                          drawing.color === entry && styles.colorButtonActive,
                        ]}
                        onPress={() => {
                          drawing.setColor(entry);
                          setRgbaDraft(parseColorToRgba(entry));
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.currentColorContainer}>
                <TouchableOpacity
                  style={[styles.currentColorBox, { backgroundColor: drawing.color }]}
                  onPress={() => setShowRgbaPicker((prev) => !prev)}
                  activeOpacity={0.85}
                />
              </View>
            </View>
            {showRgbaPicker && (
              <View style={styles.rgbaPanel}>
                <View style={styles.rgbaPanelHeader}>
                  <Text style={styles.rgbaPanelTitle}>RGBA</Text>
                  <TouchableOpacity onPress={() => setShowRgbaPicker(false)}>
                    <Text style={styles.rgbaCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <RgbaChannelSlider
                  label="R"
                  value={rgbaDraft.r}
                  min={0}
                  max={255}
                  onChange={(value) => updateChannel('r', value)}
                  trackColor="#ef4444"
                  valueText={String(Math.round(rgbaDraft.r))}
                  styles={styles}
                />
                <RgbaChannelSlider
                  label="G"
                  value={rgbaDraft.g}
                  min={0}
                  max={255}
                  onChange={(value) => updateChannel('g', value)}
                  trackColor="#22c55e"
                  valueText={String(Math.round(rgbaDraft.g))}
                  styles={styles}
                />
                <RgbaChannelSlider
                  label="B"
                  value={rgbaDraft.b}
                  min={0}
                  max={255}
                  onChange={(value) => updateChannel('b', value)}
                  trackColor="#3b82f6"
                  valueText={String(Math.round(rgbaDraft.b))}
                  styles={styles}
                />
                <RgbaChannelSlider
                  label="A"
                  value={rgbaDraft.a * 100}
                  min={0}
                  max={100}
                  onChange={(value) => updateChannel('a', value / 100)}
                  trackColor="#64748b"
                  valueText={`${Math.round(rgbaDraft.a * 100)}%`}
                  styles={styles}
                />
                <Text style={styles.rgbaCodeText}>{rgbaToColorText(rgbaDraft)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.toolbarSection}>
          <Text style={styles.sectionLabel}>Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, drawing.historyStep <= 0 && styles.actionButtonDisabled]}
              onPress={drawing.handleUndo}
              disabled={drawing.historyStep <= 0}
            >
              <ActionGlyph
                type="undo"
                color={drawing.historyStep <= 0 ? '#94a3b8' : '#111827'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, drawing.historyStep >= drawing.history.length - 1 && styles.actionButtonDisabled]}
              onPress={drawing.handleRedo}
              disabled={drawing.historyStep >= drawing.history.length - 1}
            >
              <ActionGlyph
                type="redo"
                color={drawing.historyStep >= drawing.history.length - 1 ? '#94a3b8' : '#111827'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onExportPng}>
              <ActionGlyph type="save" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearButton} onPress={drawing.handleClearAll}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ToolbarContainer>
      )}

      <View style={styles.workspace}>
        {shouldShowToggle && (
          <View style={styles.mobileOverlayActions}>
            <TouchableOpacity
              style={styles.mobileToolbarToggleButton}
              onPress={() => setToolbarVisible((prev) => !prev)}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.mobileToolbarToggleText}>{toolbarVisible ? 'Hide Tools' : 'Show Tools'}</Text>
            </TouchableOpacity>
            {shouldSuggestLandscape && (
              <View style={styles.mobileRotateHintBox}>
                <Text style={styles.mobileRotateHintText}>Rotate to landscape for full canvas.</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.gestureLayer}>
          <GestureDetector gesture={drawing.panGesture}>
            <View
              style={[styles.canvasContainer, shouldShowToggle && styles.canvasContainerMobile]}
              ref={canvasContainerRef}
              onLayout={handleCanvasLayout}
            >
              <Svg style={styles.svg}>
              <SvgRect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
              <G>
                {drawing.paths.map((entry, index) => {
                  const { scaleX, scaleY } = getEntryScale(entry);
                  const isTextEntry =
                    entry?.kind === 'text' ||
                    (typeof entry?.text === 'string' && Number.isFinite(entry?.x) && Number.isFinite(entry?.y));

                  if (isTextEntry) {
                    if (drawing.activeTextBox && String(entry?.id || '') === String(drawing.activeTextBox?.id || '')) {
                      return null;
                    }

                    const frame = getTextSelectionFrame(entry);
                    const textAlign = entry.textAlign || 'left';
                    const textAnchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';
                    const textX =
                      textAlign === 'center'
                        ? frame.x + frame.width / 2
                        : textAlign === 'right'
                          ? frame.x + frame.width - 8
                          : frame.x + 8;
                    const textY = frame.y + (entry.fontSize || 16) + 6;

                    return (
                      <G
                        key={`text-${entry?.id || index}`}
                        transform={scaleX !== 1 || scaleY !== 1 ? `scale(${scaleX} ${scaleY})` : undefined}
                      >
                        {entry.backgroundFill && (
                          <SvgRect
                            x={frame.x}
                            y={frame.y}
                            width={frame.width}
                            height={frame.height}
                            fill={entry.backgroundColor || '#ffffff'}
                          />
                        )}
                        <SvgText
                          x={textX}
                          y={textY}
                          fill={entry.color || '#111827'}
                          fontSize={entry.fontSize || 16}
                          fontWeight={entry.isBold ? '700' : '400'}
                          fontStyle={entry.isItalic ? 'italic' : 'normal'}
                          textDecoration={entry.isUnderline ? 'underline' : 'none'}
                          fontFamily={entry.fontFamily || 'Helvetica'}
                          textAnchor={textAnchor}
                        >
                          {entry.text}
                        </SvgText>
                      </G>
                    );
                  }

                  if (!entry?.path) {
                    if (entry?.kind === 'dot' && Number.isFinite(entry?.x) && Number.isFinite(entry?.y)) {
                      return (
                        <SvgCircle
                          key={`dot-${index}`}
                          cx={entry.x * scaleX}
                          cy={entry.y * scaleY}
                          r={Math.max(0.75, (Number(entry.radius) || 1) * Math.min(scaleX, scaleY))}
                          fill={entry.color || '#111827'}
                          fillOpacity={entry.strokeOpacity ?? 1}
                        />
                      );
                    }
                    return null;
                  }

                  return (
                    <Path
                      key={`path-${index}`}
                      d={entry.path}
                      stroke={entry.color}
                      strokeWidth={entry.strokeWidth}
                      strokeOpacity={entry.strokeOpacity ?? 1}
                      fill="none"
                      strokeLinecap={entry.lineCap || 'round'}
                      strokeLinejoin={entry.lineJoin || 'round'}
                      transform={scaleX !== 1 || scaleY !== 1 ? `scale(${scaleX} ${scaleY})` : undefined}
                    />
                  );
                })}

                {drawing.currentPath && drawing.drawingMode !== 'text' && (
                  <Path
                    d={drawing.currentPath}
                    stroke={drawing.getActiveStrokeColor()}
                    strokeWidth={activeStrokeProfile.strokeWidth}
                    strokeOpacity={activeStrokeProfile.strokeOpacity}
                    fill="none"
                    strokeLinecap={activeStrokeProfile.lineCap}
                    strokeLinejoin={activeStrokeProfile.lineJoin}
                  />
                )}

                {drawing.textPreviewBox && (
                  <SvgRect
                    x={drawing.textPreviewBox.x}
                    y={drawing.textPreviewBox.y}
                    width={drawing.textPreviewBox.width}
                    height={drawing.textPreviewBox.height}
                    fill="rgba(255,255,255,0.08)"
                    stroke="#0ea5e9"
                    strokeWidth={1.2}
                    strokeDasharray="5 3"
                  />
                )}
              </G>
              </Svg>

              {drawing.activeTextBox && (
                <View
                  style={[
                    styles.textCanvasEditor,
                    {
                      left: drawing.activeTextBox.x,
                      top: drawing.activeTextBox.y,
                      width: drawing.activeTextBox.width,
                      height: drawing.activeTextBox.height,
                      backgroundColor: drawing.activeTextBox.backgroundFill
                        ? drawing.activeTextBox.backgroundColor || '#ffffff'
                        : 'rgba(255,255,255,0.96)',
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.textCanvasInput,
                      {
                        fontSize: drawing.activeTextBox.fontSize,
                        color: drawing.activeTextBox.color || '#111827',
                        fontFamily: drawing.activeTextBox.fontFamily || 'Helvetica',
                        fontWeight: drawing.activeTextBox.isBold ? '700' : '400',
                        fontStyle: drawing.activeTextBox.isItalic ? 'italic' : 'normal',
                        textDecorationLine: drawing.activeTextBox.isUnderline ? 'underline' : 'none',
                        textAlign: drawing.activeTextBox.textAlign || 'left',
                      },
                    ]}
                    value={drawing.activeTextBox.text}
                    onChangeText={drawing.setActiveTextBoxText}
                    autoFocus
                    multiline
                    onBlur={drawing.commitActiveTextBox}
                  />
                </View>
              )}
            </View>
          </GestureDetector>
        </View>
      </View>

      <View style={[styles.statusBar, shouldShowToggle && styles.statusBarMobile]}>
        <View style={styles.statusLeft}>
          <Text style={[styles.statusText, shouldShowToggle && styles.statusTextMobile]}>{drawing.currentProject.name}</Text>
          <Text style={[styles.statusDivider, shouldShowToggle && styles.statusTextMobile]}>|</Text>
          <Text style={[styles.statusText, shouldShowToggle && styles.statusTextMobile]}>
            {drawing.drawingMode.charAt(0).toUpperCase() + drawing.drawingMode.slice(1)}
          </Text>
          <Text style={[styles.statusDivider, shouldShowToggle && styles.statusTextMobile]}>|</Text>
          <Text style={[styles.statusText, shouldShowToggle && styles.statusTextMobile]}>Size: {drawing.strokeWidth}px</Text>
        </View>
        <Text style={[styles.statusRight, shouldShowToggle && styles.statusTextMobile]}>
          {visibleStrokeCount} strokes | {drawing.userCount} users | {drawing.isConnected ? 'Online' : 'Offline'}
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}
