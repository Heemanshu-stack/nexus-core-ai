import os
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    from sklearn.datasets import make_classification, make_regression
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

from config import BASE_DIR, get_hardware_device_info

class PyTorchClassifierNet(nn.Module if HAS_TORCH else object):
    """Deep Neural Network architecture for classification tasks."""
    def __init__(self, input_dim: int, hidden_dim: int, num_classes: int):
        if not HAS_TORCH:
            return
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, num_classes)
        )

    def forward(self, x):
        return self.net(x)


class ModelTrainerService:
    """Service to handle model definition, GPU/CPU training, validation, and checkpointing."""

    def __init__(self):
        self.checkpoint_dir = BASE_DIR / "models" / "checkpoints"
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    def get_system_hardware(self) -> Dict[str, Any]:
        """Returns GPU CUDA vs CPU hardware state."""
        return get_hardware_device_info()

    def train_pytorch_model(
        self,
        task_type: str = "classification",
        epochs: int = 10,
        batch_size: int = 32,
        learning_rate: float = 0.001,
        num_samples: int = 1000,
        input_dim: int = 20,
        num_classes: int = 3
    ) -> Dict[str, Any]:
        """Trains a PyTorch Neural Network model utilizing GPU CUDA if available, else CPU."""
        if not HAS_TORCH:
            raise RuntimeError("PyTorch is not installed in the environment!")

        start_time = time.time()
        hardware_info = self.get_system_hardware()
        device_str = hardware_info["device_type"]
        device = torch.device(device_str if torch.cuda.is_available() else "cpu")

        # 1. Generate Synthetic Benchmark Dataset
        if HAS_SKLEARN:
            X_raw, y_raw = make_classification(
                n_samples=num_samples,
                n_features=input_dim,
                n_informative=min(input_dim, 15),
                n_classes=num_classes,
                random_state=42
            )
        else:
            X_raw = np.random.randn(num_samples, input_dim).astype(np.float32)
            y_raw = np.random.randint(0, num_classes, size=(num_samples,))

        X_train, X_val, y_train, y_val = train_test_split(
            X_raw, y_raw, test_size=0.2, random_state=42
        ) if HAS_SKLEARN else (
            X_raw[:int(num_samples*0.8)], X_raw[int(num_samples*0.8):],
            y_raw[:int(num_samples*0.8)], y_raw[int(num_samples*0.8):]
        )

        train_dataset = TensorDataset(
            torch.tensor(X_train, dtype=torch.float32),
            torch.tensor(y_train, dtype=torch.long)
        )
        val_dataset = TensorDataset(
            torch.tensor(X_val, dtype=torch.float32),
            torch.tensor(y_val, dtype=torch.long)
        )

        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

        # 2. Instantiate Model and push tensors to GPU/CPU device
        model = PyTorchClassifierNet(input_dim=input_dim, hidden_dim=64, num_classes=num_classes)
        model.to(device)

        criterion = nn.CrossEntropyLoss()
        optimizer = optim.AdamW(model.parameters(), lr=learning_rate)

        history = []
        best_val_acc = 0.0

        # 3. Training Loop
        for epoch in range(1, epochs + 1):
            model.train()
            train_loss = 0.0
            correct_train = 0
            total_train = 0

            for bx, by in train_loader:
                bx, by = bx.to(device), by.to(device)
                optimizer.zero_grad()
                outputs = model(bx)
                loss = criterion(outputs, by)
                loss.backward()
                optimizer.step()

                train_loss += loss.item() * bx.size(0)
                _, preds = torch.max(outputs, 1)
                correct_train += (preds == by).sum().item()
                total_train += bx.size(0)

            epoch_train_loss = train_loss / max(total_train, 1)
            epoch_train_acc = correct_train / max(total_train, 1)

            # Validation Loop
            model.eval()
            val_loss = 0.0
            correct_val = 0
            total_val = 0

            with torch.no_grad():
                for bx, by in val_loader:
                    bx, by = bx.to(device), by.to(device)
                    outputs = model(bx)
                    loss = criterion(outputs, by)
                    val_loss += loss.item() * bx.size(0)
                    _, preds = torch.max(outputs, 1)
                    correct_val += (preds == by).sum().item()
                    total_val += bx.size(0)

            epoch_val_loss = val_loss / max(total_val, 1)
            epoch_val_acc = correct_val / max(total_val, 1)

            if epoch_val_acc > best_val_acc:
                best_val_acc = epoch_val_acc
                # Save PyTorch Model Checkpoint
                checkpoint_path = self.checkpoint_dir / "best_pytorch_model.pt"
                torch.save({
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "best_val_acc": best_val_acc,
                    "device": device_str
                }, checkpoint_path)

            history.append({
                "epoch": epoch,
                "train_loss": round(epoch_train_loss, 4),
                "train_acc": round(epoch_train_acc * 100, 2),
                "val_loss": round(epoch_val_loss, 4),
                "val_acc": round(epoch_val_acc * 100, 2)
            })

        elapsed_time = round(time.time() - start_time, 2)

        return {
            "status": "SUCCESS",
            "framework": "PyTorch",
            "device_used": device_str.upper(),
            "device_name": hardware_info["device_name"],
            "epochs_completed": epochs,
            "total_samples": num_samples,
            "training_time_sec": elapsed_time,
            "best_val_accuracy": round(best_val_acc * 100, 2),
            "final_train_loss": history[-1]["train_loss"] if history else 0.0,
            "checkpoint_saved": str(self.checkpoint_dir / "best_pytorch_model.pt"),
            "epoch_history": history
        }

    def train_sklearn_model(
        self,
        num_samples: int = 1000,
        n_estimators: int = 100
    ) -> Dict[str, Any]:
        """Trains a Scikit-Learn Random Forest model for quick CPU/GPU baseline comparison."""
        if not HAS_SKLEARN:
            raise RuntimeError("Scikit-Learn is not installed in the environment!")

        start_time = time.time()
        X, y = make_classification(n_samples=num_samples, n_features=20, random_state=42)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        rf = RandomForestClassifier(n_estimators=n_estimators, random_state=42)
        rf.fit(X_train, y_train)

        preds = rf.predict(X_test)
        acc = accuracy_score(y_test, preds)
        precision, recall, f1, _ = precision_recall_fscore_support(y_test, preds, average="weighted")

        elapsed_time = round(time.time() - start_time, 2)

        return {
            "status": "SUCCESS",
            "framework": "Scikit-Learn",
            "model_type": "RandomForestClassifier",
            "device_used": "CPU",
            "n_estimators": n_estimators,
            "test_accuracy": round(acc * 100, 2),
            "f1_score": round(f1, 4),
            "training_time_sec": elapsed_time
        }

