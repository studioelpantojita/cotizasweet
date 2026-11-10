"""Own only test-created processes; close their complete tree using held OS handles."""
import os
import signal
import subprocess

class OwnedProcess:
    def __init__(self,*args,**kwargs):
        self.job=None
        if os.name!='nt':kwargs['start_new_session']=True
        self.process=subprocess.Popen(*args,**kwargs)
        try:
            if os.name=='nt':self._attach_windows_job()
        except BaseException:
            self.process.kill();self.process.wait();raise

    def _attach_windows_job(self):
        import ctypes
        from ctypes import wintypes as w
        class Basic(ctypes.Structure):
            _fields_=[('process_time',ctypes.c_longlong),('job_time',ctypes.c_longlong),('flags',w.DWORD),('min_ws',ctypes.c_size_t),('max_ws',ctypes.c_size_t),('active',w.DWORD),('affinity',ctypes.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
        class IO(ctypes.Structure):
            _fields_=[(name,ctypes.c_ulonglong) for name in ('reads','writes','other','read_bytes','write_bytes','other_bytes')]
        class Extended(ctypes.Structure):
            _fields_=[('basic',Basic),('io',IO),('process_memory',ctypes.c_size_t),('job_memory',ctypes.c_size_t),('peak_process',ctypes.c_size_t),('peak_job',ctypes.c_size_t)]
        kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.CreateJobObjectW.argtypes=[ctypes.c_void_p,w.LPCWSTR];kernel.CreateJobObjectW.restype=w.HANDLE
        kernel.SetInformationJobObject.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD];kernel.SetInformationJobObject.restype=w.BOOL
        kernel.AssignProcessToJobObject.argtypes=[w.HANDLE,w.HANDLE];kernel.AssignProcessToJobObject.restype=w.BOOL
        kernel.CloseHandle.argtypes=[w.HANDLE];kernel.CloseHandle.restype=w.BOOL
        job=kernel.CreateJobObjectW(None,None)
        if not job:raise ctypes.WinError(ctypes.get_last_error())
        limits=Extended();limits.basic.flags=0x2000 # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not kernel.SetInformationJobObject(job,9,ctypes.byref(limits),ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(job,int(self.process._handle)):
            error=ctypes.get_last_error();kernel.CloseHandle(job);raise ctypes.WinError(error)
        self.job=job;self.kernel=kernel

    def __getattr__(self,name):return getattr(self.process,name)

    def stop(self):
        if self.job is not None:
            self.kernel.CloseHandle(self.job);self.job=None
        elif os.name!='nt':
            try:os.killpg(self.process.pid,signal.SIGTERM)
            except ProcessLookupError:pass
        elif self.process.poll() is None:self.process.kill()
        try:self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:self.process.kill();self.process.wait(timeout=10)
