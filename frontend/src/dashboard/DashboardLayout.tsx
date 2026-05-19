import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { alpha, keyframes } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useTypewriter } from "../hooks/useTypewriter";
import { AiModeToggle } from "./AiModeToggle";
import { ThemeToggle } from "./ThemeToggle";

const blinkCaret = keyframes`
  50% { opacity: 0 }
`;

type DashboardLayoutProps = {
  children: ReactNode;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { displayed, done } = useTypewriter("Tekton Unified Dashboard");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="sticky" elevation={0} color="default" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <DashboardCustomizeOutlinedIcon color="primary" sx={{ mr: 1.25 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: -0.2 }}>
            {displayed}
            <Box
              component="span"
              sx={done ? { animation: `${blinkCaret} 0.7s step-end 5 forwards` } : undefined}
            >
              _
            </Box>
          </Typography>
          <ThemeToggle />
          <AiModeToggle />
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={theme => ({
          flexGrow: 1,
          backgroundColor: theme.vars
            ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
            : alpha(theme.palette.background.default, 1),
        })}
      >
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, height: "100%", display: "flex", flexDirection: "column" }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
