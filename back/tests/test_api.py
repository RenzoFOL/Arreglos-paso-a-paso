import os
os.environ['STUDY_MODE'] = 'true'
import unittest
from fastapi.testclient import TestClient
from app.main import app, EXERCISES

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_catalog_does_not_reveal_answers(self):
        data = self.client.get('/api/exercises').json()
        self.assertEqual(len(data), 10)
        self.assertNotIn('correct', data[0])

    def test_all_answers_and_wrong_choices(self):
        for item in EXERCISES:
            for choice in range(3):
                r = self.client.post(f'/api/exercises/{item["id"]}/check', json={'choice': choice})
                self.assertEqual(r.status_code, 200)
                self.assertEqual(r.json()['success'], choice == item['correct'])

    def test_invalid_inputs(self):
        self.assertEqual(self.client.post('/api/exercises/1/check', json={'choice': True}).status_code, 422)
        self.assertEqual(self.client.post('/api/exercises/1/check', json={'choice': 5}).status_code, 422)
        self.assertEqual(self.client.post('/api/exercises/no/check', json={'choice': 0}).status_code, 404)

    def test_export_and_formula_safety(self):
        import io
        from openpyxl import load_workbook
        data = {'schemaVersion': 1, 'appVersion': '0.1.0', 'id': 'test', 'participant': 'P01', 'startedAt': '2026-11-18', 'consent': True, 'events': [], 'tasks': [{'id': 'N01', 'prepared': 0, 'note': '=1+1'}]}
        r = self.client.post('/api/study/export', json=data)
        self.assertEqual(r.status_code, 200)
        wb = load_workbook(io.BytesIO(r.content))
        self.assertEqual(wb['Tareas']['F2'].value, "'=1+1")
        data['consent'] = False
        self.assertEqual(self.client.post('/api/study/export', json=data).status_code, 422)

if __name__ == '__main__':
    unittest.main()
