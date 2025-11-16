import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import ReactMarkdown from 'react-markdown';

import { useAppDispatch, useAppSelector } from '../hooks';
import { sendMessage, createChat, loadMessages } from '../store/chatSlice';
import { ChatMessage } from '../types';

const MODELS = [
  'claude-sonnet-4.5',
  'claude-opus-4.1',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemma-7b',
  'gemma-2b',
];

const ChatPage: React.FC = () => {
  const { chatId } = useParams();
  const dispatch = useAppDispatch();
  const { currentChat, messages, loading } = useAppSelector((state) => state.chat);
  const { settings } = useAppSelector((state) => state.user);

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(settings?.default_model || 'claude-sonnet-4.5');
  const [useWebGrounding, setUseWebGrounding] = useState(settings?.enable_web_grounding || false);
  const [useExtendedThinking, setUseExtendedThinking] = useState(settings?.enable_extended_thinking || false);
  const [useRAG, setUseRAG] = useState(settings?.enable_rag || false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatId && chatId !== currentChat?.id) {
      dispatch(loadMessages(chatId));
    }
  }, [chatId, currentChat, dispatch]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageData = {
      chatId: chatId || null,
      model: selectedModel,
      content: input,
      useWebGrounding,
      useExtendedThinking,
      useRAG,
    };

    setInput('');
    await dispatch(sendMessage(messageData));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Settings Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              label="Model"
              size="small"
            >
              {MODELS.map((model) => (
                <MenuItem key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={useWebGrounding}
                onChange={(e) => setUseWebGrounding(e.target.checked)}
                size="small"
              />
            }
            label="Web Grounding"
          />

          <FormControlLabel
            control={
              <Switch
                checked={useExtendedThinking}
                onChange={(e) => setUseExtendedThinking(e.target.checked)}
                size="small"
              />
            }
            label="Extended Thinking"
          />

          <FormControlLabel
            control={
              <Switch
                checked={useRAG}
                onChange={(e) => setUseRAG(e.target.checked)}
                size="small"
              />
            }
            label="RAG"
          />
        </Stack>
      </Paper>

      {/* Messages Area */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2, px: 2 }}>
        {messages.map((message: ChatMessage) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              mb: 2,
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Paper
              sx={{
                p: 2,
                maxWidth: '70%',
                bgcolor: message.role === 'user' ? 'primary.light' : 'grey.100',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {message.role === 'assistant' ? (
                  <SmartToyIcon sx={{ mr: 1, fontSize: 20 }} />
                ) : (
                  <PersonIcon sx={{ mr: 1, fontSize: 20 }} />
                )}
                <Typography variant="caption" color="text.secondary">
                  {message.role === 'assistant' ? message.model || 'AI' : 'You'}
                </Typography>
              </Box>
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.tokens_used && (
                <Chip
                  label={`${message.tokens_used} tokens`}
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Paper>
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress />
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            variant="outlined"
            disabled={loading}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatPage;
