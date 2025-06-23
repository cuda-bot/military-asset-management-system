import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    Container,
    Paper,
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(formData.username, formData.password);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <Container component="main" maxWidth="sm">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: 400,
                    }}
                >
                    <Box
                        sx={{
                            backgroundColor: 'primary.main',
                            borderRadius: '50%',
                            p: 2,
                            mb: 2,
                        }}
                    >
                        <LockIcon sx={{ color: 'white', fontSize: 40 }} />
                    </Box>

                    <Typography component="h1" variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Military Asset Management
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Sign in to access the system
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="username"
                            label="Username"
                            name="username"
                            autoComplete="username"
                            autoFocus
                            value={formData.username}
                            onChange={handleChange}
                            disabled={loading}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2, py: 1.5 }}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Sign In'}
                        </Button>
                    </Box>

                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            Demo Credentials:
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            Admin: admin / password123
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            Commander: commander / password123
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default Login; 