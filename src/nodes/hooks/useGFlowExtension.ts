import { useState } from 'react';
import { getApiBaseUrl } from '../../utils/apiConfig';

interface GFlowExtensionOptions {
  projectData: any;
  setProjectData: (data: any) => void;
}

export function useGFlowExtension({ projectData, setProjectData }: GFlowExtensionOptions) {
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleCreateProject = async () => {
    const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
    if (useRemote) {
      setIsCreatingProject(true);
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          setIsCreatingProject(false);
          const mockId = projectData.selectedProjectId 
            ? `storymee-proj-${projectData.selectedProjectId}` 
            : `storymee-proj-default`;
          setProjectData({ ...projectData, id: mockId });
          resolve(mockId);
        }, 300);
      });
    }

    const extId = localStorage.getItem('STORYMEE_EXT_ID');
    if (!extId) {
      alert("⚠️ Extension ID chưa được thiết lập!");
      return null;
    }

    setIsCreatingProject(true);
    
    // Auto-refresh token trước khi tạo project
    await new Promise((resolve) => {
      if (!(window as any).chrome?.runtime) return resolve(false);
      (window as any).chrome.runtime.sendMessage(extId, { action: "OPEN_LABS_BACKGROUND" }, () => {
        setTimeout(() => {
          (window as any).chrome.runtime.sendMessage(extId, { action: "GET_GOOGLE_LABS_TOKEN" }, () => {
            resolve(true); // Luôn luôn cho qua để tạo Project!
          });
        }, 3500);
      });
    });

    return new Promise<string | null>((resolve) => {
      if ((window as any).chrome?.runtime?.sendMessage) {
        (window as any).chrome.runtime.sendMessage(extId, {
          action: "CREATE_PROJECT",
          payload: {
            projectName: projectData.name || 'Untitled Project',
          }
        }, (response: any) => {
          setIsCreatingProject(false);
          if ((window as any).chrome.runtime.lastError || response?.error) {
            alert("Lỗi Tạo Project từ Google Labs:\n" + ((window as any).chrome.runtime.lastError?.message || response?.error));
            resolve(null);
          } else if (response?.projectId) {
            setProjectData({ ...projectData, id: response.projectId });
            resolve(response.projectId);
          } else {
            resolve(null);
          }
        });
      } else {
        setTimeout(() => {
          setIsCreatingProject(false);
          const mockId = "mock-proj-" + Math.floor(Math.random() * 10000);
          setProjectData({ ...projectData, id: mockId });
          resolve(mockId);
        }, 1500);
      }
    });
  };

  const uploadReferenceImage = async (base64Image: string): Promise<string | null> => {
    const extId = localStorage.getItem('STORYMEE_EXT_ID');
    const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';

    if (!projectData.id || projectData.id === 'new') return null;

    try {
      if (useRemote) {
        // Convert base64 to Blob and upload to core-api to get a clean S3/public URL
        const base64ToBlob = (base64: string) => {
          const parts = base64.split(';base64,');
          const contentType = parts[0].split(':')[1];
          const raw = window.atob(parts[1]);
          const rawLength = raw.length;
          const uInt8Array = new Uint8Array(rawLength);
          for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          return new Blob([uInt8Array], { type: contentType });
        };

        const blob = base64ToBlob(base64Image);
        const formData = new FormData();
        formData.append('file', blob, 'reference_image.jpg');

        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        
        const res = await fetch(`${baseUrl}/internal/v1/asset/world/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUB_API_KEY}`
          },
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          console.log("[GFlowExtension] Remote upload success:", data.url);
          return data.url;
        } else {
          throw new Error("HTTP upload error: " + res.status);
        }
      } else if (extId && (window as any).chrome?.runtime) {
        const result: any = await new Promise((resolve) => {
          (window as any).chrome.runtime.sendMessage(extId, {
            action: "UPLOAD_REFERENCE_IMAGE",
            payload: { projectId: projectData.id, base64Image }
          }, (response: any) => resolve(response));
        });
        return result?.mediaId || null;
      }
    } catch (err) {
      console.error("Lỗi upload GFlow:", err);
    }
    return null;
  };

  return {
    isCreatingProject,
    handleCreateProject,
    uploadReferenceImage
  };
}
