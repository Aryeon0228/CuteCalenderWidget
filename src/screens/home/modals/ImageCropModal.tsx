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

interface CropArea {
  originX: number;
  originY: number;
  width: number;
  height: number;
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

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface ImageCropModalProps {
  visible: boolean;
  theme: ThemeColors;
  language: AppLanguage;
  imageUri: string | null;
  sourceWidth: number;
  sourceHeight: number;
  isApplying: boolean;
  onCancel: () => void;
  onConfirm: (cropArea: CropArea) => Promise<void> | void;
  onHapticLight: () => void;
}

const MIN_CROP_SIZE = 72;
const HANDLE_TOUCH_SIZE = 28;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

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
  const [cropRect, setCropRect] = useState<CropRect | null>(null);

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
    setCropRect({
      x: imageFrame.width * 0.1,
      y: imageFrame.height * 0.1,
      width: imageFrame.width * 0.8,
      height: imageFrame.height * 0.8,
    });
    dragState.current.mode = null;
    dragState.current.startRect = null;
  }, [visible, imageUri, imageFrame?.width, imageFrame?.height]);

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasWidth(width);
    setCanvasHeight(height);
  };

  const beginDrag = (mode: DragMode, event: GestureResponderEvent) => {
    if (!cropRect || !imageFrame || isApplying) return;
    dragState.current.mode = mode;
    dragState.current.startX = event.nativeEvent.pageX;
    dragState.current.startY = event.nativeEvent.pageY;
    dragState.current.startRect = cropRect;
  };

  const onDragMove = (event: GestureResponderEvent) => {
    if (!imageFrame || !dragState.current.mode || !dragState.current.startRect || isApplying) {
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

  const handleConfirm = async () => {
    if (!cropRect || !imageFrame || !sourceWidth || !sourceHeight || isApplying) return;
    const cropArea = toPixelCropArea(cropRect, imageFrame, sourceWidth, sourceHeight);
    await onConfirm(cropArea);
  };

  const title = language === 'ko' ? '영역 선택' : 'Crop Area';
  const subtitle = language === 'ko' ? '드래그해서 이동, 모서리로 크기 조절' : 'Drag to move, corner handles to resize';
  const cancelLabel = language === 'ko' ? '취소' : 'Cancel';
  const applyLabel = language === 'ko' ? '적용' : 'Apply';
  const applyingLabel = language === 'ko' ? '적용 중...' : 'Applying...';
  const helpLabel = language === 'ko'
    ? '원하는 부분만 선택하면 해당 영역 기준으로 색을 추출해요.'
    : 'Only the selected area will be used for color extraction.';

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
                backgroundColor: isApplying ? theme.backgroundTertiary : theme.accent,
                opacity: isApplying ? 0.75 : 1,
              },
            ]}
            onPress={handleConfirm}
            disabled={isApplying}
          >
            <Text style={[styles.headerButtonText, { color: isApplying ? theme.textSecondary : '#fff' }]}>
              {isApplying ? applyingLabel : applyLabel}
            </Text>
          </TouchableOpacity>
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

            {!!imageFrame && !!cropRect && (
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
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.helpText, { color: theme.textMuted }]}>{helpLabel}</Text>
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
