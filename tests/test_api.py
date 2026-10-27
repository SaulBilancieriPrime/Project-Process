import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from app import app  # noqa: E402


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_root_is_ok(self):
        res = self.client.get("/", headers={"Range": "bytes=0-10"})
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"Project Process API", res.data)

    def test_employees_search(self):
        people = [
            {
                "id": "abc",
                "name": "Ada Lovelace",
                "email": "ada@primeeng.com",
                "upn": "ada@primeeng.com",
                "enabled": True,
            }
        ]
        with patch("app.search_employees", return_value=people) as search:
            res = self.client.get("/api/employees?q=ada")
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["employees"], people)
        search.assert_called_once_with("ada", 20)

    def test_employees_bad_limit(self):
        res = self.client.get("/api/employees?limit=0")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.get_json()["ok"])

    def test_employees_sql_error(self):
        with patch("app.search_employees", side_effect=RuntimeError("down")):
            res = self.client.get("/api/employees?q=ada")
        self.assertEqual(res.status_code, 503)
        body = res.get_json()
        self.assertFalse(body["ok"])
        self.assertIn("detail", body)


if __name__ == "__main__":
    unittest.main()
