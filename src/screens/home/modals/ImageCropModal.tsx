import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';

import { ThemeColors } from '../../../store/themeStore';
import { type AppLanguage } from '../../../lib/colorUtils';

export interface CropArea {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface CropSelectionPayload {
  mode: 'rect' | 'lasso';
  cropArea: CropArea;
  normalizedPath?: NormalizedPoint[];
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LineSegment {
  cx: number;
  cy: number;
  length: number;
  angle: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
type SelectionMode = 'lasso' | 'rect';

interface ImageCropModalProps {
  visible: boolean;
  theme: ThemeColors;
  language: AppLanguage;
  imageUri: string | null;
  sourceWidth: number;
  sourceHeight: number;
  isApplying: boolean;
  onCancel: () => void;
  onConfirm: (selection: CropSelectionPayload) => Promise<void> | void;
  onHapticLight: () => void;
}

const MIN_CROP_SIZE = 72;
const HANDLE_TOUCH_SIZE = 28;
const MIN_LASSO_DISTANCE = 3;
const MAX_LASSO_POINTS = 420;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const distanceBetween = (a: NormalizedPoint, b: NormalizedPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const toLineSegment = (from: NormalizedPoint, to: NormalizedPoint): LineSegment | null => {
  const length = distanceBetween(from, to);
  if (length < 1) return null;
  return {
    cx: (from.x + to.x) / 2,
    cy: (from.y + to.y) / 2,
    length,
    angle: Math.atan2(to.y - from.y, to.x - from.x),
  };
};

const getMovedRect = (
  startRect: CropRect,
  dx: number,
  dy: number,
  boundsWidth: number,
  boundsHeight: number
): CropRect => {
  const maxX = Math.max(boundsWidth - startRect.width, 0);
  const maxY = Math.max(boundsHeight - startRect.height, 0);
  return {
    x: clamp(startRect.x + dx, 0, maxX),
    y: clamp(startRect.y + dy, 0, maxY),
    width: startRect.width,
    height: startRect.height,
  };
};

const getResizedRect = (
  mode: Exclude<DragMode, 'move'>,
  startRect: CropRect,
  dx: number,
  dy: number,
  boundsWidth: number,
  boundsHeight: number
): CropRect => {
  const startLeft = startRect.x;
  const startTop = startRect.y;
  const startRight = startRect.x + startRect.width;
  const startBottom = startRect.y + startRect.height;

  let left = startLeft;
  let top = startTop;
  let right = startRight;
  let bottom = startBottom;

  if (mode === 'nw') {
    left = clamp(startLeft + dx, 0, startRight - MIN_CROP_SIZE);
    top = clamp(startTop + dy, 0, startBottom - MIN_CROP_SIZE);
  } else if (mode === 'ne') {
    right = clamp(startRight + dx, startLeft + MIN_CROP_SIZE, boundsWidth);
    top = clamp(startTop + dy, 0, startBottom - MIN_CROP_SIZE);
  } else if (mode === 'sw') {
    left = clamp(startLeft + dx, 0, startRight - MIN_CROP_SIZE);
    bottom = clamp(startBottom + dy, startTop + MIN_CROP_SIZE, boundsHeight);
  } else {
    right = clamp(startRight + dx, startLeft + MIN_CROP_SIZE, boundsWidth);
    bottom = clamp(startBottom + dy, startTop + MIN_CROP_SIZE, boundsHeight);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const toPixelCropArea = (
  cropRect: CropRect,
  imageFrame: ImageFrame,
  sourceWidth: number,
  sourceHeight: number
): CropArea => {
  const scaleX = sourceWidth / imageFrame.width;
  const scaleY = sourceHeight / imageFrame.height;

  const originX = clamp(Math.round(cropRect.x * scaleX), 0, Math.max(sourceWidth - 1, 0));
  const originY = clamp(Math.round(cropRect.y * scaleY), 0, Math.max(sourceHeight - 1, 0));
  const width = clamp(Math.round(cropRect.width * scaleX), 1, sourceWidth - originX);
  const height = clamp(Math.round(cropRect.height * scaleY), 1, sourceHeight - originY);

  return { originX, originY, width, height };
};

const getLassoBounds = (points: NormalizedPoint[]): CropRect | null => {
  if (points.length < 3) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  return {
    x: minX,
    y: minY,
    width,
    height,
  };
};

export default function ImageCropModal({
  visible,
  theme,
  language,
  imageUri,
  sourceWidth,
  sourceHeight,
  isApplying,
  onCancel,
  onConfirm,
  onHapticLight,
}: ImageCropModalProps) {
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('lasso');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [lassoPoints, setLassoPoints] = useState<NormalizedPoint[]>([]);

  const dragState = useRef<{
    mode: DragMode | null;
    startX: number;
    startY: number;
    startRect: CropRect | null;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startRect: null,
  });

  const imageFrame = useMemo<ImageFrame | null>(() => {
    if (!canvasWidth || !canvasHeight || !sourceWidth || !sourceHeight) {
      return null;
    }

    const imageAspect = sourceWidth / sourceHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    if (canvasAspect > imageAspect) {
      const height = canvasHeight;
      const width = height * imageAspect;
      return {
        x: (canvasWidth - width) / 2,
        y: 0,
        width,
        height,
      };
    }

    const width = canvasWidth;
    const height = width / imageAspect;
    return {
      x: 0,
      y: (canvasHeight - height) / 2,
      width,
      height,
    };
  }, [canvasWidth, canvasHeight, sourceWidth, sourceHeight]);

  useEffect(() => {
    if (!visible || !imageUri || !imageFrame) return;
    setSelectionMode('lasso');
    setLassoPoints([]);
    setCropRect({
      x: imageFrame.width * 0.1,
      y: imageFrame.height * 0.1,
      width: imageFrame.width * 0.8,
      height: imageFrame.height * 0.8,
    });
    dragState.current.mode = null;
    dragState.current.startRect = null;
  }, [visible, imageUri, imageFrame?.width, imageFrame?.height]);

  const lassoBounds = useMemo(() => getLassoBounds(lassoPoints), [lassoPoints]);

  const lassoSegments = useMemo<LineSegment[]>(() => {
    if (lassoPoints.length < 2) return [];
    const segments: LineSegment[] = [];

    for (let i = 1; i < lassoPoints.length; i++) {
      const line = toLineSegment(lassoPoints[i - 1], lassoPoints[i]);
      if (line) segments.push(line);
    }

    if (lassoPoints.length >= 3) {
      const closeLine = toLineSegment(lassoPoints[lassoPoints.length - 1], lassoPoints[0]);
      if (closeLine) segments.push(closeLine);
    }

    return segments;
  }, [lassoPoints]);

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasWidth(width);
    setCanvasHeight(height);
  };

  const beginDrag = (mode: DragMode, event: GestureResponderEvent) => {
    if (!cropRect || !imageFrame || isApplying || selectionMode !== 'rect') return;
    dragState.current.mode = mode;
    dragState.current.startX = event.nativeEvent.pageX;
    dragState.current.startY = event.nativeEvent.pageY;
    dragState.current.startRect = cropRect;
  };

  const onDragMove = (event: GestureResponderEvent) => {
    if (
      !imageFrame ||
      !dragState.current.mode ||
      !dragState.current.startRect ||
      isApplying ||
      selectionMode !== 'rect'
    ) {
      return;
    }
    const dx = event.nativeEvent.pageX - dragState.current.startX;
    const dy = event.nativeEvent.pageY - dragState.current.startY;
    const startRect = dragState.current.startRect;

    const nextRect = dragState.current.mode === 'move'
      ? getMovedRect(startRect, dx, dy, imageFrame.width, imageFrame.height)
      : getResizedRect(
        dragState.current.mode,
        startRect,
        dx,
        dy,
        imageFrame.width,
        imageFrame.height
      );

    setCropRect(nextRect);
  };

  const endDrag = () => {
    dragState.current.mode = null;
    dragState.current.startRect = null;
  };

  const getResponderProps = (mode: DragMode) => ({
    onStartShouldSetResponder: () => !isApplying,
    onMoveShouldSetResponder: () => !isApplying,
    onResponderGrant: (event: GestureResponderEvent) => beginDrag(mode, event),
    onResponderMove: onDragMove,
    onResponderRelease: endDrag,
    onResponderTerminate: endDrag,
  });

  const clampLassoPoint = (x: number, y: number): NormalizedPoint => {
    if (!imageFrame) return { x, y };
    return {
      x: clamp(x, 0, imageFrame.width),
      y: clamp(y, 0, imageFrame.height),
    };
  };

  const beginLasso = (event: GestureResponderEvent) => {
    if (!imageFrame || isApplying || selectionMode !== 'lasso') return;
    const point = clampLassoPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
    setLassoPoints([point]);
  };

  const moveLasso = (event: GestureResponderEvent) => {
    if (!imageFrame || isApplying || selectionMode !== 'lasso') return;
    const point = clampLassoPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);

    setLassoPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && distanceBetween(last, point) < MIN_LASSO_DISTANCE) {
        return prev;
      }

      const appended = [...prev, point];
      if (appended.length <= MAX_LASSO_POINTS) {
        return appended;
      }

      const thinned = appended.filter((_, index) => index % 2 === 0);
      if (thinned.length < 3) return appended;
      return thinned;
    });
  };

  const lassoResponderProps = {
    onStartShouldSetResponder: () => selectionMode === 'lasso' && !isApplying,
    onMoveShouldSetResponder: () => selectionMode === 'lasso' && !isApplying,
    onResponderGrant: beginLasso,
    onResponderMove: moveLasso,
    onResponderRelease: () => undefined,
    onResponderTerminate: () => undefined,
  };

  const canApply = useMemo(() => {
    if (selectionMode === 'rect') {
      return !!cropRect;
    }
    return !!lassoBounds && lassoPoints.length >= 3 && lassoBounds.width >= 10 && lassoBounds.height >= 10;
  }, [selectionMode, cropRect, lassoBounds, lassoPoints.length]);

  const handleConfirm = async () => {
    if (!imageFrame || !sourceWidth || !sourceHeight || isApplying) return;

    if (selectionMode === 'rect') {
      if (!cropRect) return;
      const cropArea = toPixelCropArea(cropRect, imageFrame, sourceWidth, sourceHeight);
      await onConfirm({ mode: 'rect', cropArea });
      return;
    }

    if (!lassoBounds || lassoPoints.length < 3) return;
    const cropArea = toPixelCropArea(lassoBounds, imageFrame, sourceWidth, sourceHeight);

    const normalizedPath: NormalizedPoint[] = lassoPoints.map((point) => ({
      x: clamp((point.x - lassoBounds.x) / lassoBounds.width, 0, 1),
      y: clamp((point.y - lassoBounds.y) / lassoBounds.height, 0, 1),
    }));

    await onConfirm({
      mode: 'lasso',
      cropArea,
      normalizedPath,
    });
  };

  const selectLassoMode = () => {
    onHapticLight();
    setSelectionMode('lasso');
  };

  const selectRectMode = () => {
    onHapticLight();
    setSelectionMode('rect');
  };

  const clearLasso = () => {
    onHapticLight();
    setLassoPoints([]);
  };

  const title = language === 'ko' ? '영역 선택' : 'Select Area';
  const subtitle = selectionMode === 'lasso'
    ? (language === 'ko' ? '자유 드래그로 원하는 형태를 그려주세요' : 'Trace the shape with free-drag')
    : (language === 'ko' ? '사각형을 이동/조절해서 선택하세요' : 'Move or resize the box');
  const cancelLabel = language === 'ko' ? '취소' : 'Cancel';
  const applyLabel = language === 'ko' ? '적용' : 'Apply';
  const applyingLabel = language === 'ko' ? '적용 중...' : 'Applying...';
  const lassoModeLabel = language === 'ko' ? '자유 드래그' : 'Free Drag';
  const rectModeLabel = language === 'ko' ? '박스' : 'Box';
  const redrawLabel = language === 'ko' ? '다시 그리기' : 'Redraw';
  const lassoGuide = language === 'ko'
    ? '이미지 위에 손가락으로 영역을 감싸 그리면, 그 모양대로 색을 추출해요.'
    : 'Draw around the area with your finger to extract colors from that shape.';
  const rectGuide = language === 'ko'
    ? '사각형 안쪽 영역 기준으로 색을 추출해요.'
    : 'Colors are extracted from the area inside the box.';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}> 
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.backgroundTertiary }]}
            onPress={() => {
              onHapticLight();
              onCancel();
            }}
            disabled={isApplying}
          >
            <Text style={[styles.headerButtonText, { color: theme.textSecondary }]}> 
              {cancelLabel}
            </Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.headerButton,
              styles.applyButton,
              {
                backgroundColor: !canApply || isApplying ? theme.backgroundTertiary : theme.accent,
                opacity: !canApply || isApplying ? 0.75 : 1,
              },
            ]}
            onPress={handleConfirm}
            disabled={!canApply || isApplying}
          >
            <Text
              style={[
                styles.headerButtonText,
                { color: !canApply || isApplying ? theme.textSecondary : '#fff' },
              ]}
            >
              {isApplying ? applyingLabel : applyLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.modeRow, { borderBottomColor: theme.border }]}> 
          <TouchableOpacity
            style={[
              styles.modeButton,
              {
                backgroundColor: selectionMode === 'lasso' ? theme.accent : theme.backgroundTertiary,
              },
            ]}
            onPress={selectLassoMode}
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: selectionMode === 'lasso' ? '#fff' : theme.textSecondary },
              ]}
            >
              {lassoModeLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              {
                backgroundColor: selectionMode === 'rect' ? theme.accent : theme.backgroundTertiary,
              },
            ]}
            onPress={selectRectMode}
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: selectionMode === 'rect' ? '#fff' : theme.textSecondary },
              ]}
            >
              {rectModeLabel}
            </Text>
          </TouchableOpacity>
          {selectionMode === 'lasso' && (
            <TouchableOpacity
              style={[styles.redrawButton, { backgroundColor: theme.backgroundTertiary }]}
              onPress={clearLasso}
              disabled={isApplying}
            >
              <Text style={[styles.redrawButtonText, { color: theme.textSecondary }]}>{redrawLabel}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.canvasOuter}>
          <View style={styles.canvas} onLayout={onCanvasLayout}>
            {!!imageUri && !!imageFrame && (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.image,
                  {
                    left: imageFrame.x,
                    top: imageFrame.y,
                    width: imageFrame.width,
                    height: imageFrame.height,
                  },
                ]}
                resizeMode="contain"
              />
            )}

            {!!imageFrame && (
              <View
                style={[
                  styles.cropLayer,
                  {
                    left: imageFrame.x,
                    top: imageFrame.y,
                    width: imageFrame.width,
                    height: imageFrame.height,
                  },
                ]}
              >
                {selectionMode === 'lasso' ? (
                  <View style={StyleSheet.absoluteFill} {...lassoResponderProps}>
                    {lassoBounds && (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.lassoBounds,
                          {
                            left: lassoBounds.x,
                            top: lassoBounds.y,
                            width: lassoBounds.width,
                            height: lassoBounds.height,
                            borderColor: theme.accent,
                          },
                        ]}
                      />
                    )}

                    {lassoPoints.length === 0 && (
                      <View pointerEvents="none" style={styles.lassoHintWrap}>
                        <Text style={styles.lassoHintText}>
                          {language === 'ko' ? '손가락으로 영역을 그려주세요' : 'Draw your selection here'}
                        </Text>
                      </View>
                    )}

                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      {lassoSegments.map((segment, index) => (
                        <View
                          key={`segment-${index}`}
                          style={[
                            styles.lassoSegment,
                            {
                              left: segment.cx - segment.length / 2,
                              top: segment.cy - 1,
                              width: segment.length,
                              transform: [{ rotate: `${segment.angle}rad` }],
                              backgroundColor: theme.accent,
                            },
                          ]}
                        />
                      ))}
                      {lassoPoints.length > 0 && (
                        <View
                          style={[
                            styles.lassoStartDot,
                            {
                              left: lassoPoints[0].x - 4,
                              top: lassoPoints[0].y - 4,
                              borderColor: theme.accent,
                            },
                          ]}
                        />
                      )}
                    </View>
                  </View>
                ) : (
                  <>
                    {!!cropRect && (
                      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                        <View style={[styles.mask, { left: 0, top: 0, width: imageFrame.width, height: cropRect.y }]} />
                        <View
                          style={[
                            styles.mask,
                            {
                              left: 0,
                              top: cropRect.y + cropRect.height,
                              width: imageFrame.width,
                              height: Math.max(imageFrame.height - (cropRect.y + cropRect.height), 0),
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.mask,
                            {
                              left: 0,
                              top: cropRect.y,
                              width: cropRect.x,
                              height: cropRect.height,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.mask,
                            {
                              left: cropRect.x + cropRect.width,
                              top: cropRect.y,
                              width: Math.max(imageFrame.width - (cropRect.x + cropRect.width), 0),
                              height: cropRect.height,
                            },
                          ]}
                        />
                      </View>
                    )}

                    {!!cropRect && (
                      <View
                        style={[
                          styles.cropRect,
                          {
                            left: cropRect.x,
                            top: cropRect.y,
                            width: cropRect.width,
                            height: cropRect.height,
                            borderColor: theme.accent,
                          },
                        ]}
                        {...getResponderProps('move')}
                      >
                        <View style={[styles.gridV, { left: '33.333%' }]} pointerEvents="none" />
                        <View style={[styles.gridV, { left: '66.666%' }]} pointerEvents="none" />
                        <View style={[styles.gridH, { top: '33.333%' }]} pointerEvents="none" />
                        <View style={[styles.gridH, { top: '66.666%' }]} pointerEvents="none" />

                        <View style={[styles.handle, styles.handleTopLeft]} {...getResponderProps('nw')}>
                          <View style={[styles.handleDot, { borderColor: theme.accent }]} />
                        </View>
                        <View style={[styles.handle, styles.handleTopRight]} {...getResponderProps('ne')}>
                          <View style={[styles.handleDot, { borderColor: theme.accent }]} />
                        </View>
                        <View style={[styles.handle, styles.handleBottomLeft]} {...getResponderProps('sw')}>
                          <View style={[styles.handleDot, { borderColor: theme.accent }]} />
                        </View>
                        <View style={[styles.handle, styles.handleBottomRight]} {...getResponderProps('se')}>
                          <View style={[styles.handleDot, { borderColor: theme.accent }]} />
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.helpText, { color: theme.textMuted }]}> 
          {selectionMode === 'lasso' ? lassoGuide : rectGuide}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b17',
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
  },
  headerButton: {
    minWidth: 64,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  applyButton: {
    minWidth: 72,
  },
  headerButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeButton: {
    minWidth: 88,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  redrawButton: {
    marginLeft: 'auto',
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  redrawButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  canvasOuter: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  canvas: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  image: {
    position: 'absolute',
  },
  cropLayer: {
    position: 'absolute',
  },
  lassoHintWrap: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lassoHintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lassoBounds: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  lassoSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  lassoStartDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1.5,
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  cropRect: {
    position: 'absolute',
    borderWidth: 2,
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_TOUCH_SIZE,
    height: HANDLE_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 2,
  },
  handleTopLeft: {
    top: -HANDLE_TOUCH_SIZE / 2,
    left: -HANDLE_TOUCH_SIZE / 2,
  },
  handleTopRight: {
    top: -HANDLE_TOUCH_SIZE / 2,
    right: -HANDLE_TOUCH_SIZE / 2,
  },
  handleBottomLeft: {
    bottom: -HANDLE_TOUCH_SIZE / 2,
    left: -HANDLE_TOUCH_SIZE / 2,
  },
  handleBottomRight: {
    bottom: -HANDLE_TOUCH_SIZE / 2,
    right: -HANDLE_TOUCH_SIZE / 2,
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    fontWeight: '500',
  },
});
