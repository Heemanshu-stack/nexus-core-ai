import pytest
from services.model_trainer import ModelTrainerService

def test_hardware_detection():
    trainer = ModelTrainerService()
    hw_info = trainer.get_system_hardware()
    assert "device_type" in hw_info
    assert hw_info["device_type"] in ("cuda", "cpu")
    assert "device_name" in hw_info

def test_pytorch_training_pipeline():
    trainer = ModelTrainerService()
    result = trainer.train_pytorch_model(epochs=2, batch_size=16, num_samples=100)
    assert result["status"] == "SUCCESS"
    assert result["framework"] == "PyTorch"
    assert result["device_used"] in ("CUDA", "CPU")
    assert "best_val_accuracy" in result
    assert len(result["epoch_history"]) == 2

def test_sklearn_training_pipeline():
    trainer = ModelTrainerService()
    result = trainer.train_sklearn_model(num_samples=100, n_estimators=10)
    assert result["status"] == "SUCCESS"
    assert result["framework"] == "Scikit-Learn"
    assert "test_accuracy" in result
    assert result["test_accuracy"] >= 0.0
