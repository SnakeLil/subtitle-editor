import { useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  Box,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Translate as TranslateIcon,
} from "@mui/icons-material";
import type { BatchTranslateProgress as ProgressType } from "./lib/batchTranslate";

interface BatchTranslateProgressProps {
  open: boolean;
  onClose: () => void;
  progressMap: Record<string, ProgressType>;
  getLanguageName: (langKey: string) => string;
}

export default function BatchTranslateProgress({
  open,
  onClose,
  progressMap,
  getLanguageName,
}: BatchTranslateProgressProps) {

  const progressList = useMemo(() => {
    return Object.values(progressMap);
  }, [progressMap]);

  const stats = useMemo(() => {
    const completed = progressList.filter((p) => p.status === "success").length;
    const failed = progressList.filter((p) => p.status === "error").length;
    const inProgress = progressList.filter((p) => p.status === "translating").length;
    const pending = progressList.filter((p) => p.status === "pending").length;
    return { completed, failed, inProgress, pending, total: progressList.length };
  }, [progressList]);

  const canClose = stats.inProgress === 0 && stats.pending === 0;

  const getStatusIcon = (status: ProgressType["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircleIcon color="success" />;
      case "error":
        return <ErrorIcon color="error" />;
      case "translating":
        return <TranslateIcon color="primary" />;
      default:
        return <TranslateIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: ProgressType["status"]) => {
    switch (status) {
      case "success":
        return "success";
      case "error":
        return "error";
      case "translating":
        return "primary";
      default:
        return "default";
    }
  };

  const getStatusText = (status: ProgressType["status"]) => {
    switch (status) {
      case "success":
        return "Translation completed";
      case "error":
        return "Translation failed";
      case "translating":
        return "Translating...";
      case "pending":
        return "Pending";
      default:
        return "";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={canClose ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={!canClose}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">Batch Translate</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {stats.completed + stats.failed} / {stats.total}
            </Typography>
            {canClose && (
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <List sx={{ py: 0 }}>
          {progressList.map((progress) => (
            <ListItem
              key={progress.lang}
              sx={{
                flexDirection: "column",
                alignItems: "stretch",
                py: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
                "&:last-child": {
                  borderBottom: "none",
                },
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {getStatusIcon(progress.status)}
                  <Typography variant="body1" fontWeight={500}>
                    {getLanguageName(progress.lang)}
                  </Typography>
                </Box>
                <Chip
                  label={getStatusText(progress.status)}
                  size="small"
                  color={getStatusColor(progress.status)}
                  variant={progress.status === "pending" ? "outlined" : "filled"}
                />
              </Box>
              
              {progress.status === "translating" && (
                <Box sx={{ width: "100%" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Progress
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {progress.progress.toFixed(0)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress.progress}
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                </Box>
              )}

              {progress.status === "success" && (
                <Box sx={{ width: "100%" }}>
                  <LinearProgress
                    variant="determinate"
                    value={100}
                    color="success"
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                </Box>
              )}

              {progress.status === "error" && progress.error && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {progress.error}
                </Typography>
              )}

              {progress.status === "pending" && (
                <Box sx={{ width: "100%" }}>
                  <LinearProgress
                    variant="determinate"
                    value={0}
                    sx={{ height: 6, borderRadius: 1, bgcolor: "action.disabledBackground" }}
                  />
                </Box>
              )}
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
