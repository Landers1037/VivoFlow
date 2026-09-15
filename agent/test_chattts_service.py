import unittest

import chattts_service


class ChatTtsServiceTests(unittest.TestCase):
    def test_cpu_device_is_always_available(self):
        self.assertEqual(chattts_service.choose_device("cpu"), "cpu")
        self.assertEqual(chattts_service.choose_device("unknown"), "cpu")

    def test_explicit_cuda_does_not_silently_fallback(self):
        if chattts_service.torch is None or not chattts_service.torch.cuda.is_available():
            self.assertEqual(chattts_service.choose_device("cuda"), "unavailable")

    def test_health_starts_unloaded(self):
        self.assertIsNone(chattts_service.MODEL)
        self.assertIn(chattts_service.DEVICE, {"unavailable", "cpu", "cuda"})


if __name__ == "__main__":
    unittest.main()
