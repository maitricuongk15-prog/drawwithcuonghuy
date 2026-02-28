import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import io from 'socket.io-client';
import {
  DEFAULT_COLOR,
  DEFAULT_DRAWING_MODE,
  DEFAULT_STROKE_WIDTH,
} from '../constants/drawing';
import { getActiveServerUrl, setActiveServerUrl } from '../config/server';
import { buildShapePath, getStrokeColor } from '../utils/drawing';

const SHAPE_MODES = new Set(['line', 'rectangle', 'circle', 'triangle', 'diamond', 'arrow']);
const DEFAULT_TEXT_OPTIONS = {
  fontFamily: 'Helvetica',
  fontSize: 16,
  color: '#111827',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  textAlign: 'left',
  lineHeightPercent: 120,
  backgroundFill: false,
  backgroundColor: '#ffffff',
};

function normalizeTextOptions(source = {}) {
  const fontSize = Math.max(10, Math.min(72, Number(source.fontSize) || DEFAULT_TEXT_OPTIONS.fontSize));
  const lineHeightPercent = Math.max(
    80,
    Math.min(300, Number(source.lineHeightPercent) || DEFAULT_TEXT_OPTIONS.lineHeightPercent)
  );

  return {
    ...DEFAULT_TEXT_OPTIONS,
    ...source,
    fontSize,
    lineHeightPercent,
    isBold: Boolean(source.isBold),
    isItalic: Boolean(source.isItalic),
    isUnderline: Boolean(source.isUnderline),
    backgroundFill: Boolean(source.backgroundFill),
    textAlign: ['left', 'center', 'right'].includes(source.textAlign)
      ? source.textAlign
      : DEFAULT_TEXT_OPTIONS.textAlign,
    color: String(source.color || DEFAULT_TEXT_OPTIONS.color),
    backgroundColor: String(source.backgroundColor || DEFAULT_TEXT_OPTIONS.backgroundColor),
  };
}

function getStrokeProfile(mode, baseWidth) {
  const safeWidth = Math.max(1, Number(baseWidth) || 1);

  if (mode === 'pencil') {
    return {
      strokeWidth: Math.max(1, safeWidth * 0.9),
      strokeOpacity: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
    };
  }

  if (mode === 'brush') {
    return {
      strokeWidth: Math.max(2, safeWidth * 1.8),
      strokeOpacity: 0.55,
      lineCap: 'round',
      lineJoin: 'round',
    };
  }

  if (mode === 'eraser') {
    return {
      strokeWidth: Math.max(2, safeWidth * 1.4),
      strokeOpacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    };
  }

  return {
    strokeWidth: safeWidth,
    strokeOpacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
  };
}

function clonePaths(value) {
  return JSON.parse(JSON.stringify(value));
}

function createTextId() {
  return `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTextEntry(entry) {
  return (
    entry?.kind === 'text' ||
    (typeof entry?.text === 'string' && Number.isFinite(entry?.x) && Number.isFinite(entry?.y))
  );
}

function estimateTextWidth(entry) {
  const fontSize = Number(entry?.fontSize) || 16;
  const content = String(entry?.text || '');
  return Math.max(fontSize, content.length * fontSize * 0.58);
}

function getTextFrame(entry) {
  if (
    Number.isFinite(entry?.boxX) &&
    Number.isFinite(entry?.boxY) &&
    Number.isFinite(entry?.boxWidth) &&
    Number.isFinite(entry?.boxHeight)
  ) {
    return {
      x: Number(entry.boxX),
      y: Number(entry.boxY),
      width: Number(entry.boxWidth),
      height: Number(entry.boxHeight),
      fontSize: Number(entry?.fontSize) || 16,
    };
  }

  const fontSize = Number(entry?.fontSize) || 16;
  const width = Math.max(120, estimateTextWidth(entry) + 16);
  const height = Math.max(34, fontSize + 14);

  return {
    x: Number(entry?.x || 0) - 8,
    y: Number(entry?.y || 0) - fontSize - 8,
    width,
    height,
    fontSize,
  };
}

function findTextAtPoint(entries, x, y) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!isTextEntry(entry)) {
      continue;
    }

    const frame = getTextFrame(entry);
    const left = frame.x - 4;
    const right = frame.x + frame.width + 4;
    const top = frame.y - 4;
    const bottom = frame.y + frame.height + 4;

    if (x >= left && x <= right && y >= top && y <= bottom) {
      return entry;
    }
  }

  return null;
}

function createDraftTextBoxFromOptions(options, text, id) {
  const normalizedOptions = normalizeTextOptions(options);
  const lineHeight = Math.max(
    normalizedOptions.fontSize * 1.2,
    (normalizedOptions.fontSize * normalizedOptions.lineHeightPercent) / 100
  );

  return {
    id: id || createTextId(),
    x: 96,
    y: 96,
    width: 190,
    height: Math.max(34, lineHeight + 12),
    text: String(text || ''),
    color: normalizedOptions.color,
    fontFamily: normalizedOptions.fontFamily,
    fontSize: normalizedOptions.fontSize,
    isBold: normalizedOptions.isBold,
    isItalic: normalizedOptions.isItalic,
    isUnderline: normalizedOptions.isUnderline,
    textAlign: normalizedOptions.textAlign,
    lineHeightPercent: normalizedOptions.lineHeightPercent,
    backgroundFill: normalizedOptions.backgroundFill,
    backgroundColor: normalizedOptions.backgroundColor,
  };
}

function normalizeCanvasEntry(entry) {
  if (isTextEntry(entry)) {
    const options = normalizeTextOptions(entry);
    const frame = getTextFrame({
      ...entry,
      fontSize: options.fontSize,
    });
    return {
      ...entry,
      kind: 'text',
      id: String(entry?.id || createTextId()),
      x: Number(entry?.x) || frame.x + 8,
      y: Number(entry?.y) || frame.y + options.fontSize + 6,
      text: String(entry?.text || ''),
      fontSize: options.fontSize,
      color: entry?.color || '#111827',
      fontFamily: String(entry?.fontFamily || options.fontFamily),
      isBold: options.isBold,
      isItalic: options.isItalic,
      isUnderline: options.isUnderline,
      textAlign: options.textAlign,
      lineHeightPercent: options.lineHeightPercent,
      backgroundFill: options.backgroundFill,
      backgroundColor: String(entry?.backgroundColor || options.backgroundColor),
      boxX: frame.x,
      boxY: frame.y,
      boxWidth: frame.width,
      boxHeight: frame.height,
      mode: 'text',
    };
  }

  return {
    ...entry,
    kind: entry?.kind || 'path',
  };
}

function normalizeCanvasEntries(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeCanvasEntry);
}

function buildTextEntryFromBox(box) {
  const options = normalizeTextOptions(box);
  const width = Math.max(120, Number(box.width) || 120);
  const height = Math.max(34, Number(box.height) || options.fontSize + 14);
  const x = Number(box.x || 0);
  const y = Number(box.y || 0);

  return {
    id: String(box.id || createTextId()),
    kind: 'text',
    mode: 'text',
    x: x + 8,
    y: y + options.fontSize + 6,
    text: String(box.text || '').trim(),
    color: box.color || '#111827',
    fontSize: options.fontSize,
    fontFamily: options.fontFamily,
    isBold: options.isBold,
    isItalic: options.isItalic,
    isUnderline: options.isUnderline,
    textAlign: options.textAlign,
    lineHeightPercent: options.lineHeightPercent,
    backgroundFill: options.backgroundFill,
    backgroundColor: box.backgroundColor || options.backgroundColor,
    boxX: x,
    boxY: y,
    boxWidth: width,
    boxHeight: height,
  };
}

export function useDrawing({ notify, requestConfirm } = {}) {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidthState] = useState(DEFAULT_STROKE_WIDTH);
  const [drawingMode, setDrawingModeState] = useState(DEFAULT_DRAWING_MODE);
  const [userCount, setUserCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [currentProject, setCurrentProject] = useState(null);
  const [textDraft, setTextDraft] = useState('');
  const [textOptions, setTextOptions] = useState(DEFAULT_TEXT_OPTIONS);
  const [isTextArmed, setIsTextArmed] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState('');
  const [activeTextBox, setActiveTextBox] = useState(null);
  const [textPreviewBox, setTextPreviewBox] = useState(null);

  const socketRef = useRef(null);
  const currentPathRef = useRef('');
  const startPointRef = useRef(null);
  const historyRef = useRef([]);
  const historyStepRef = useRef(-1);
  const pendingProjectIdRef = useRef('');
  const connectedUserRef = useRef(null);
  const currentProjectRef = useRef(null);
  const pathsRef = useRef([]);

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  const saveToHistory = useCallback((nextPaths) => {
    const clipped = historyRef.current.slice(0, historyStepRef.current + 1);
    clipped.push(clonePaths(nextPaths));
    const nextStep = clipped.length - 1;
    historyRef.current = clipped;
    historyStepRef.current = nextStep;
    setHistory(clipped);
    setHistoryStep(nextStep);
  }, []);

  const resetDrawingState = useCallback(() => {
    setPaths([]);
    setCurrentPath('');
    setHistory([]);
    setHistoryStep(-1);
    setTextDraft('');
    setTextOptions(DEFAULT_TEXT_OPTIONS);
    setIsTextArmed(false);
    setSelectedTextId('');
    setActiveTextBox(null);
    setTextPreviewBox(null);
    historyRef.current = [];
    historyStepRef.current = -1;
    currentPathRef.current = '';
    startPointRef.current = null;
    pathsRef.current = [];
    setUserCount(0);
    setOnlineUsers([]);
  }, []);

  const setDrawingMode = useCallback((mode) => {
    setDrawingModeState(mode);
    setSelectedTextId('');

    if (mode !== 'text') {
      setTextDraft('');
      setIsTextArmed(false);
      setActiveTextBox(null);
      setTextPreviewBox(null);
      return;
    }
    setIsTextArmed(true);
    setTextDraft('');
    setActiveTextBox(null);
    setTextPreviewBox(null);
  }, []);

  const setStrokeWidth = useCallback((nextValue) => {
    const numeric = Number(nextValue);
    const safeValue = Number.isFinite(numeric) ? numeric : DEFAULT_STROKE_WIDTH;
    const clamped = Math.max(1, Math.min(256, Math.round(safeValue)));
    setStrokeWidthState(clamped);
  }, []);

  const setActiveTextBoxText = useCallback((value) => {
    setActiveTextBox((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        text: value,
      };
    });
  }, []);

  const handlePanelTextChange = useCallback(
    (value) => {
      setTextDraft(value);
      if (activeTextBox) {
        setActiveTextBoxText(value);
      }
    },
    [activeTextBox, setActiveTextBoxText]
  );

  const applyTextOptions = useCallback(
    (patch = {}) => {
      const normalizedPatch = normalizeTextOptions({ ...textOptions, ...patch });

      setTextOptions((prev) => ({
        ...prev,
        ...normalizedPatch,
      }));

      setActiveTextBox((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          ...normalizedPatch,
        };
      });

      if (activeTextBox || !selectedTextId) {
        return;
      }

      setPaths((prevPaths) => {
        const nextText = String(textDraft ?? '');
        const updated = prevPaths.map((entry) => {
          if (!isTextEntry(entry) || String(entry.id) !== String(selectedTextId)) {
            return entry;
          }

          const nextWidth = Math.max(
            120,
            estimateTextWidth({
              ...entry,
              text: nextText,
            }) + 16
          );

          return {
            ...entry,
            text: nextText,
            boxWidth: Number.isFinite(entry.boxWidth) ? Math.max(nextWidth, entry.boxWidth) : nextWidth,
            ...normalizedPatch,
          };
        });

        saveToHistory(updated);
        if (socketRef.current && isConnected) {
          socketRef.current.emit('sync-drawing', updated);
        }
        return updated;
      });
    },
    [activeTextBox, isConnected, saveToHistory, selectedTextId, textDraft, textOptions]
  );

  const commitActiveTextBox = useCallback(() => {
    if (!activeTextBox) {
      return false;
    }

    const normalized = String(activeTextBox.text || '').trim();

    if (!normalized) {
      setPaths((prevPaths) => {
        const updated = prevPaths.filter(
          (entry) => !(isTextEntry(entry) && String(entry.id) === String(activeTextBox.id))
        );
        if (updated.length !== prevPaths.length) {
          saveToHistory(updated);
          if (socketRef.current && isConnected) {
            socketRef.current.emit('sync-drawing', updated);
          }
        }
        return updated;
      });
      setSelectedTextId('');
      setActiveTextBox(null);
      setIsTextArmed(true);
      return false;
    }

    const committedEntry = buildTextEntryFromBox({
      ...activeTextBox,
      text: normalized,
      fontSize: Number(activeTextBox.fontSize) || textOptions.fontSize,
      color: activeTextBox.color || getStrokeColor('text', color),
    });

    setPaths((prevPaths) => {
      let updated = prevPaths.map((entry) => {
        if (!isTextEntry(entry) || String(entry.id) !== String(committedEntry.id)) {
          return entry;
        }
        return committedEntry;
      });

      const exists = updated.some(
        (entry) => isTextEntry(entry) && String(entry.id) === String(committedEntry.id)
      );
      if (!exists) {
        updated = [...updated, committedEntry];
      }

      saveToHistory(updated);
      if (socketRef.current && isConnected) {
        socketRef.current.emit('sync-drawing', updated);
      }
      return updated;
    });

    setTextDraft(normalized);
    setTextOptions((prev) => ({
      ...prev,
      ...normalizeTextOptions(committedEntry),
    }));
    setSelectedTextId(committedEntry.id);
    setActiveTextBox(null);
    setIsTextArmed(true);
    return true;
  }, [activeTextBox, color, isConnected, saveToHistory, textOptions.fontSize]);

  const commitSelectedTextFromPanel = useCallback(() => {
    if (!selectedTextId || activeTextBox) {
      return false;
    }

    const normalized = String(textDraft || '').trim();
    let changed = false;

    setPaths((prevPaths) => {
      if (!normalized) {
        const filtered = prevPaths.filter(
          (entry) => !(isTextEntry(entry) && String(entry.id) === String(selectedTextId))
        );
        if (filtered.length !== prevPaths.length) {
          changed = true;
          saveToHistory(filtered);
          if (socketRef.current && isConnected) {
            socketRef.current.emit('sync-drawing', filtered);
          }
        }
        return filtered;
      }

      const updated = prevPaths.map((entry) => {
        if (!isTextEntry(entry) || String(entry.id) !== String(selectedTextId)) {
          return entry;
        }

        const nextWidth = Math.max(
          120,
          estimateTextWidth({
            ...entry,
            text: normalized,
          }) + 16
        );

        changed = true;
        return {
          ...entry,
          text: normalized,
          boxWidth: Number.isFinite(entry.boxWidth) ? Math.max(nextWidth, entry.boxWidth) : nextWidth,
        };
      });

      if (changed) {
        saveToHistory(updated);
        if (socketRef.current && isConnected) {
          socketRef.current.emit('sync-drawing', updated);
        }
      }
      return updated;
    });

    if (!normalized) {
      setSelectedTextId('');
      setTextDraft('');
      return false;
    }

    return changed;
  }, [activeTextBox, isConnected, saveToHistory, selectedTextId, textDraft]);

  const commitPanelText = useCallback(() => {
    if (activeTextBox) {
      return commitActiveTextBox();
    }
    return commitSelectedTextFromPanel();
  }, [activeTextBox, commitActiveTextBox, commitSelectedTextFromPanel]);

  const cancelActiveTextBox = useCallback(() => {
    setActiveTextBox(null);
    setIsTextArmed(true);
  }, []);

  const armTextPlacement = useCallback(() => {
    if (drawingMode !== 'text') {
      setDrawingModeState('text');
    }
    setSelectedTextId('');
    setActiveTextBox(null);
    setTextPreviewBox(null);
    setIsTextArmed(true);
  }, [drawingMode]);

  const disarmTextPlacement = useCallback(() => {
    setIsTextArmed(false);
    setTextPreviewBox(null);
  }, []);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    pendingProjectIdRef.current = '';
    setIsConnected(false);
    setCurrentProject(null);
    resetDrawingState();
  }, [resetDrawingState]);

  const connectSocket = useCallback(
    (user) => {
      connectedUserRef.current = user;
      disconnectSocket();

      const preferredServerUrl = user?.serverUrlUsed || getActiveServerUrl();
      const serverUrl = preferredServerUrl || 'http://localhost:3001';
      setActiveServerUrl(serverUrl);

      const socket = io(serverUrl, {
        auth: {
          username: user.username,
          displayName: user.displayName,
        },
        transports: ['websocket'],
        reconnection: true,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        if (pendingProjectIdRef.current) {
          socket.emit('join-project', { projectId: pendingProjectIdRef.current });
          pendingProjectIdRef.current = '';
        }
      });

      socket.on('project-joined', (payload = {}) => {
        const incomingProject = payload.project || null;
        const incomingPaths = normalizeCanvasEntries(payload.paths);

        setCurrentProject(incomingProject);
        setPaths(incomingPaths);
        setCurrentPath('');
        setTextDraft('');
        setTextOptions(DEFAULT_TEXT_OPTIONS);
        setIsTextArmed(false);
        setSelectedTextId('');
        setActiveTextBox(null);
        setTextPreviewBox(null);
        currentPathRef.current = '';
        startPointRef.current = null;
        historyRef.current = [];
        historyStepRef.current = -1;
        setHistory([]);
        setHistoryStep(-1);
        saveToHistory(incomingPaths);
      });

      socket.on('left-project', () => {
        setCurrentProject(null);
        resetDrawingState();
      });

      socket.on('draw', (data) => {
        const normalizedEntry = normalizeCanvasEntry(data);
        setPaths((prevPaths) => {
          const updated = [...prevPaths, normalizedEntry];
          saveToHistory(updated);
          return updated;
        });
      });

      socket.on('sync-drawing', (data) => {
        const incoming = normalizeCanvasEntries(data);
        setPaths(incoming);
        saveToHistory(incoming);
      });

      socket.on('clear-canvas', (payload) => {
        setPaths([]);
        setCurrentPath('');
        setTextDraft('');
        setTextOptions(DEFAULT_TEXT_OPTIONS);
        setIsTextArmed(false);
        setSelectedTextId('');
        setActiveTextBox(null);
        setTextPreviewBox(null);
        currentPathRef.current = '';
        startPointRef.current = null;
        saveToHistory([]);

        if (payload?.clearedBy && payload.clearedBy !== user.displayName) {
          notify?.({
            type: 'info',
            message: `${payload.clearedBy} cleared the canvas.`,
          });
        }
      });

      socket.on('user-list', (data) => {
        setUserCount(data?.count ?? 0);
        setOnlineUsers(data?.users ?? []);
      });

      socket.on('project-error', (errorPayload) => {
        if (errorPayload?.action === 'join') {
          setCurrentProject(null);
          resetDrawingState();
        }
        notify?.({
          type: 'error',
          message: errorPayload?.message || 'Project operation failed.',
        });
      });

      socket.on('project-deleted', (payload = {}) => {
        if (!payload?.projectId) {
          return;
        }

        if (String(currentProjectRef.current?.id || '') === String(payload.projectId)) {
          setCurrentProject(null);
          resetDrawingState();
          notify?.({
            type: 'warning',
            message: `Project was deleted by ${payload.deletedBy || 'owner'}.`,
          });
        }
      });

      socket.on('connect_error', () => {
        setIsConnected(false);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        setUserCount(0);
        setOnlineUsers([]);
      });
    },
    [disconnectSocket, notify, resetDrawingState, saveToHistory]
  );

  const joinProject = useCallback(
    (project) => {
      if (!project?.id) {
        notify?.({ type: 'warning', message: 'Invalid project.' });
        return;
      }

      const projectId = String(project.id);
      pendingProjectIdRef.current = projectId;
      setCurrentProject(project);
      resetDrawingState();

      if (socketRef.current?.connected) {
        socketRef.current.emit('join-project', { projectId });
        pendingProjectIdRef.current = '';
        return;
      }

      if (!socketRef.current && connectedUserRef.current) {
        connectSocket(connectedUserRef.current);
      }
    },
    [connectSocket, notify, resetDrawingState]
  );

  const leaveProject = useCallback(() => {
    if (socketRef.current?.connected && currentProject?.id) {
      socketRef.current.emit('leave-project');
    }
    pendingProjectIdRef.current = '';
    setCurrentProject(null);
    resetDrawingState();
  }, [currentProject?.id, resetDrawingState]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  const handleUndo = useCallback(() => {
    if (historyStepRef.current <= 0) {
      notify?.({ type: 'info', message: 'Nothing to undo.' });
      return;
    }

    const nextStep = historyStepRef.current - 1;
    const previousPaths = historyRef.current[nextStep];
    setPaths(previousPaths);
    setHistoryStep(nextStep);
    historyStepRef.current = nextStep;

    if (socketRef.current && isConnected) {
      socketRef.current.emit('sync-drawing', previousPaths);
    }
  }, [isConnected, notify]);

  const handleRedo = useCallback(() => {
    if (historyStepRef.current >= historyRef.current.length - 1) {
      notify?.({ type: 'info', message: 'Nothing to redo.' });
      return;
    }

    const nextStep = historyStepRef.current + 1;
    const nextPaths = historyRef.current[nextStep];
    setPaths(nextPaths);
    setHistoryStep(nextStep);
    historyStepRef.current = nextStep;

    if (socketRef.current && isConnected) {
      socketRef.current.emit('sync-drawing', nextPaths);
    }
  }, [isConnected, notify]);

  const performClearAll = useCallback(() => {
    if (!currentProject?.id) {
      notify?.({ type: 'warning', message: 'Open a project first.' });
      return;
    }

    setPaths([]);
    setCurrentPath('');
    setTextDraft('');
    setTextOptions(DEFAULT_TEXT_OPTIONS);
    setIsTextArmed(false);
    setSelectedTextId('');
    setActiveTextBox(null);
    setTextPreviewBox(null);
    currentPathRef.current = '';
    startPointRef.current = null;
    saveToHistory([]);
    notify?.({ type: 'success', message: 'Canvas cleared.' });

    if (socketRef.current && isConnected) {
      socketRef.current.emit('clear-canvas');
    }
  }, [currentProject?.id, isConnected, notify, saveToHistory]);

  const handleClearAll = useCallback(() => {
    if (!requestConfirm) {
      performClearAll();
      return;
    }

    requestConfirm({
      title: 'Clear canvas',
      message: 'Clear canvas for everyone in this project?',
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: performClearAll,
    });
  }, [performClearAll, requestConfirm]);

  const handleSave = useCallback(() => {
    notify?.({ type: 'success', message: `Saved ${paths.length} items.` });
  }, [notify, paths.length]);

  const setTextFontSize = useCallback(
    (nextValue) => {
      applyTextOptions({ fontSize: nextValue });
    },
    [applyTextOptions]
  );

  const setTextFontFamily = useCallback(
    (fontFamily) => {
      applyTextOptions({ fontFamily: String(fontFamily || DEFAULT_TEXT_OPTIONS.fontFamily) });
    },
    [applyTextOptions]
  );

  const setTextAlign = useCallback(
    (textAlign) => {
      applyTextOptions({ textAlign });
    },
    [applyTextOptions]
  );

  const setTextColor = useCallback(
    (textColor) => {
      applyTextOptions({ color: textColor || '#111827' });
    },
    [applyTextOptions]
  );

  const setTextLineHeightPercent = useCallback(
    (lineHeightPercent) => {
      applyTextOptions({ lineHeightPercent });
    },
    [applyTextOptions]
  );

  const toggleTextBold = useCallback(() => {
    applyTextOptions({ isBold: !textOptions.isBold });
  }, [applyTextOptions, textOptions.isBold]);

  const toggleTextItalic = useCallback(() => {
    applyTextOptions({ isItalic: !textOptions.isItalic });
  }, [applyTextOptions, textOptions.isItalic]);

  const toggleTextUnderline = useCallback(() => {
    applyTextOptions({ isUnderline: !textOptions.isUnderline });
  }, [applyTextOptions, textOptions.isUnderline]);

  const toggleTextBackgroundFill = useCallback(() => {
    applyTextOptions({ backgroundFill: !textOptions.backgroundFill });
  }, [applyTextOptions, textOptions.backgroundFill]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .enabled(!activeTextBox)
        .onStart((e) => {
          if (drawingMode === 'text') {
            if (!currentProject?.id) {
              notify?.({ type: 'warning', message: 'Open a project before editing text.' });
              return;
            }

            const activeEntries = pathsRef.current;
            const hitText = findTextAtPoint(activeEntries, e.x, e.y);
            if (hitText) {
              const hitId = String(hitText.id || '');
              const selectedOptions = normalizeTextOptions(hitText);
              setSelectedTextId(hitId);
              setTextDraft(String(hitText.text || ''));
              setTextOptions((prev) => ({
                ...prev,
                ...selectedOptions,
              }));
              setIsTextArmed(false);
              setTextPreviewBox(null);
              const frame = getTextFrame(hitText);
              setActiveTextBox({
                id: hitText.id,
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height,
                text: String(hitText.text || ''),
                color: hitText.color || getStrokeColor('text', color),
                fontFamily: String(hitText.fontFamily || selectedOptions.fontFamily),
                fontSize: Number(hitText.fontSize) || selectedOptions.fontSize,
                isBold: selectedOptions.isBold,
                isItalic: selectedOptions.isItalic,
                isUnderline: selectedOptions.isUnderline,
                textAlign: selectedOptions.textAlign,
                lineHeightPercent: selectedOptions.lineHeightPercent,
                backgroundFill: selectedOptions.backgroundFill,
                backgroundColor: String(hitText.backgroundColor || selectedOptions.backgroundColor),
              });
              return;
            }

            setSelectedTextId('');
            setTextDraft('');
            startPointRef.current = { x: e.x, y: e.y };
            setTextPreviewBox({
              x: Math.max(8, e.x),
              y: Math.max(8, e.y),
              width: 1,
              height: 1,
            });
            setIsTextArmed(true);
            return;
          }

          if (SHAPE_MODES.has(drawingMode)) {
            startPointRef.current = { x: e.x, y: e.y };
            currentPathRef.current = '';
            setCurrentPath('');
            return;
          }

          startPointRef.current = { x: e.x, y: e.y };
          currentPathRef.current = `M ${e.x} ${e.y}`;
          setCurrentPath(currentPathRef.current);
        })
        .onUpdate((e) => {
          if (drawingMode === 'text') {
            if (!startPointRef.current) {
              return;
            }

            const sx = Number(startPointRef.current.x || e.x);
            const sy = Number(startPointRef.current.y || e.y);
            const x = Math.max(8, Math.min(sx, e.x));
            const y = Math.max(8, Math.min(sy, e.y));
            const width = Math.max(1, Math.abs(e.x - sx));
            const height = Math.max(1, Math.abs(e.y - sy));
            setTextPreviewBox({ x, y, width, height });
            return;
          }

          if (SHAPE_MODES.has(drawingMode)) {
            if (!startPointRef.current) {
              return;
            }

            const preview = buildShapePath(drawingMode, startPointRef.current, {
              x: e.x,
              y: e.y,
            });
            currentPathRef.current = preview;
            setCurrentPath(preview);
            return;
          }

          currentPathRef.current += ` L ${e.x} ${e.y}`;
          setCurrentPath(currentPathRef.current);
        })
        .onEnd((e) => {
          if (drawingMode === 'text') {
            if (!startPointRef.current) {
              return;
            }
            const sx = Number(startPointRef.current.x || e.x);
            const sy = Number(startPointRef.current.y || e.y);
            const x = Math.max(8, Math.min(sx, e.x));
            const y = Math.max(8, Math.min(sy, e.y));
            const dragWidth = Math.abs(e.x - sx);
            const dragHeight = Math.abs(e.y - sy);
            const lineHeight = Math.max(
              textOptions.fontSize * 1.2,
              (textOptions.fontSize * textOptions.lineHeightPercent) / 100
            );
            const useDefault = dragWidth < 4 && dragHeight < 4;
            const createdBox = {
              id: createTextId(),
              x: useDefault ? Math.max(8, sx) : x,
              y: useDefault ? Math.max(8, sy) : y,
              width: useDefault ? 190 : Math.max(120, dragWidth),
              height: useDefault ? Math.max(34, lineHeight + 12) : Math.max(34, dragHeight),
              text: '',
              color: textOptions.color || getStrokeColor('text', color),
              fontFamily: textOptions.fontFamily,
              fontSize: textOptions.fontSize,
              isBold: textOptions.isBold,
              isItalic: textOptions.isItalic,
              isUnderline: textOptions.isUnderline,
              textAlign: textOptions.textAlign,
              lineHeightPercent: textOptions.lineHeightPercent,
              backgroundFill: textOptions.backgroundFill,
              backgroundColor: textOptions.backgroundColor,
            };

            setSelectedTextId(createdBox.id);
            setActiveTextBox(createdBox);
            setTextPreviewBox(null);
            startPointRef.current = null;
            setIsTextArmed(false);
            return;
          }

          if (!currentProject?.id) {
            return;
          }

          const endX = Number.isFinite(e?.x) ? e.x : Number(startPointRef.current?.x || 0);
          const endY = Number.isFinite(e?.y) ? e.y : Number(startPointRef.current?.y || 0);
          let pathValue = currentPathRef.current;
          if (SHAPE_MODES.has(drawingMode)) {
            if (!startPointRef.current) {
              return;
            }
            pathValue = buildShapePath(drawingMode, startPointRef.current, {
              x: endX,
              y: endY,
            });
          }

          if (!pathValue) {
            return;
          }

          const strokeProfile = getStrokeProfile(drawingMode, strokeWidth);
          const isTapStroke = !SHAPE_MODES.has(drawingMode) && !String(pathValue).includes(' L ');

          if (isTapStroke) {
            const dotEntry = {
              kind: 'dot',
              x: endX,
              y: endY,
              radius: Math.max(0.75, strokeProfile.strokeWidth / 2),
              color: getStrokeColor(drawingMode, color),
              strokeOpacity: strokeProfile.strokeOpacity,
              mode: drawingMode,
            };

            setPaths((prevPaths) => {
              const updated = [...prevPaths, dotEntry];
              saveToHistory(updated);
              if (socketRef.current && isConnected) {
                socketRef.current.emit('draw', dotEntry);
              }
              return updated;
            });

            setCurrentPath('');
            currentPathRef.current = '';
            startPointRef.current = null;
            return;
          }

          const newPath = {
            kind: 'path',
            path: pathValue,
            color: getStrokeColor(drawingMode, color),
            strokeWidth: strokeProfile.strokeWidth,
            strokeOpacity: strokeProfile.strokeOpacity,
            lineCap: strokeProfile.lineCap,
            lineJoin: strokeProfile.lineJoin,
            mode: drawingMode,
          };

          setPaths((prevPaths) => {
            const updated = [...prevPaths, newPath];
            saveToHistory(updated);
            if (socketRef.current && isConnected) {
              socketRef.current.emit('draw', newPath);
            }
            return updated;
          });

          setCurrentPath('');
          currentPathRef.current = '';
          startPointRef.current = null;
        }),
    [
      activeTextBox,
      color,
      currentProject?.id,
      drawingMode,
      isConnected,
      isTextArmed,
      notify,
      saveToHistory,
      strokeWidth,
      textDraft,
      textOptions,
    ]
  );

  return {
    paths,
    currentPath,
    color,
    strokeWidth,
    drawingMode,
    userCount,
    onlineUsers,
    isConnected,
    history,
    historyStep,
    currentProject,
    textDraft,
    textOptions,
    textFontSize: textOptions.fontSize,
    isTextArmed,
    selectedTextId,
    activeTextBox,
    textPreviewBox,
    panGesture,
    connectSocket,
    disconnectSocket,
    resetDrawingState,
    joinProject,
    leaveProject,
    setColor,
    setStrokeWidth,
    setDrawingMode,
    handleUndo,
    handleRedo,
    handleClearAll,
    handleSave,
    setTextDraft,
    handlePanelTextChange,
    commitPanelText,
    setTextFontSize,
    setTextFontFamily,
    setTextAlign,
    setTextColor,
    setTextLineHeightPercent,
    toggleTextBold,
    toggleTextItalic,
    toggleTextUnderline,
    toggleTextBackgroundFill,
    setActiveTextBoxText,
    commitActiveTextBox,
    cancelActiveTextBox,
    armTextPlacement,
    disarmTextPlacement,
    getActiveStrokeColor: () => getStrokeColor(drawingMode, color),
    getActiveStrokeProfile: () => getStrokeProfile(drawingMode, strokeWidth),
  };
}
