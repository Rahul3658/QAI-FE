import { useEffect } from 'react';
import './Modal.css';

const Modal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    type = 'confirm', // 'confirm', 'success', 'error', 'warning', 'info'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    showCancel = true
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            case 'info':
                return 'ℹ';
            default:
                return '?';
        }
    };

    const getIconColor = () => {
        switch (type) {
            case 'success':
                return 'var(--success)';
            case 'error':
                return 'var(--danger)';
            case 'warning':
                return 'var(--warning)';
            case 'info':
                return 'var(--info)';
            default:
                return 'var(--primary)';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-icon" style={{ color: getIconColor() }}>
                    {getIcon()}
                </div>
                
                <h2 className="modal-title">{title}</h2>
                <p className="modal-message">{message}</p>
                
                <div className="modal-actions">
                    {showCancel && (
                        <button 
                            className="modal-btn modal-btn-cancel" 
                            onClick={onClose}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button 
                        className={`modal-btn modal-btn-confirm modal-btn-${type}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
