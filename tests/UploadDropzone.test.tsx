// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadDropzone } from '../components/UploadDropzone';

afterEach(() => {
  cleanup();
});

function file(name: string, type: string, size = 100) {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

describe('UploadDropzone', () => {
  it('renders idle help text by default', () => {
    render(<UploadDropzone status="idle" onFiles={() => {}} />);
    expect(screen.getByText('파일을 끌어놓거나 아래 버튼을 눌러주세요')).toBeTruthy();
  });

  it('renders drag-over message when status changes', () => {
    render(<UploadDropzone status="drag-over" onFiles={() => {}} />);
    expect(screen.getByText('여기에 놓으세요')).toBeTruthy();
  });

  it('renders custom error text on error', () => {
    render(<UploadDropzone status="error" errorText="사이즈가 너무 커요" onFiles={() => {}} />);
    expect(screen.getByText('사이즈가 너무 커요')).toBeTruthy();
  });

  it('shows "업로드 중…" with progress percent', () => {
    render(<UploadDropzone status="uploading" progress={42.7} onFiles={() => {}} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('업로드 중…');
    expect(status.textContent).toContain('43%');
  });

  it('shows retry button on error when onRetry provided', async () => {
    const onRetry = vi.fn();
    render(<UploadDropzone status="error" onRetry={onRetry} onFiles={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('switches to drag-over on dragenter (uncontrolled)', () => {
    render(<UploadDropzone status="idle" onFiles={() => {}} />);
    const zone = screen.getByRole('region');
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    expect(zone.getAttribute('data-status')).toBe('drag-over');
  });

  it('calls onStatusChange instead of internal state when controlled', () => {
    const onStatusChange = vi.fn();
    render(<UploadDropzone status="idle" onStatusChange={onStatusChange} onFiles={() => {}} />);
    const zone = screen.getByRole('region');
    fireEvent.dragEnter(zone);
    expect(onStatusChange).toHaveBeenCalledWith('drag-over');
  });

  it('calls onFiles with valid files on drop', () => {
    const onFiles = vi.fn();
    render(<UploadDropzone status="idle" accept="image/*" onFiles={onFiles} />);
    const zone = screen.getByRole('region');
    const f = file('photo.png', 'image/png');
    fireEvent.drop(zone, { dataTransfer: { files: [f] } });
    expect(onFiles).toHaveBeenCalledWith([f]);
  });

  it('rejects mime mismatch and calls onReject', () => {
    const onFiles = vi.fn();
    const onReject = vi.fn();
    render(<UploadDropzone status="idle" accept="image/*" onFiles={onFiles} onReject={onReject} />);
    const zone = screen.getByRole('region');
    const f = file('doc.pdf', 'application/pdf');
    fireEvent.drop(zone, { dataTransfer: { files: [f] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith('mime', [f]);
  });

  it('rejects oversize files', () => {
    const onFiles = vi.fn();
    const onReject = vi.fn();
    render(
      <UploadDropzone
        status="idle"
        accept="image/*"
        maxSizeBytes={50}
        onFiles={onFiles}
        onReject={onReject}
      />,
    );
    const zone = screen.getByRole('region');
    const f = file('big.png', 'image/png', 200);
    fireEvent.drop(zone, { dataTransfer: { files: [f] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith('size', [f]);
  });

  it('accepts ".ext" pattern', () => {
    const onFiles = vi.fn();
    render(<UploadDropzone status="idle" accept=".jpg,.png" onFiles={onFiles} />);
    const zone = screen.getByRole('region');
    const f = file('photo.JPG', '');
    fireEvent.drop(zone, { dataTransfer: { files: [f] } });
    expect(onFiles).toHaveBeenCalledWith([f]);
  });

  it('renders primary and secondary actions when provided', async () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    render(
      <UploadDropzone
        status="idle"
        onFiles={() => {}}
        primaryAction={{ label: '사진 촬영', onClick: primary }}
        secondaryAction={{ label: '파일 선택', onClick: secondary }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '사진 촬영' }));
    await userEvent.click(screen.getByRole('button', { name: '파일 선택' }));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
  });

  it('falls back to default "파일 선택" button when no actions provided', () => {
    render(<UploadDropzone status="idle" onFiles={() => {}} />);
    expect(screen.getByRole('button', { name: '파일 선택' })).toBeTruthy();
  });

  it('renders preview when status is success', () => {
    render(
      <UploadDropzone
        status="success"
        onFiles={() => {}}
        preview={<img alt="upload preview" src="data:image/png;base64,iVBORw0KG=" />}
      />,
    );
    expect(screen.getByAltText('upload preview')).toBeTruthy();
  });

  it('disables actions when disabled=true', async () => {
    const primary = vi.fn();
    render(
      <UploadDropzone
        status="idle"
        disabled
        onFiles={() => {}}
        primaryAction={{ label: '사진 촬영', onClick: primary }}
      />,
    );
    const button = screen.getByRole('button', { name: '사진 촬영' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
