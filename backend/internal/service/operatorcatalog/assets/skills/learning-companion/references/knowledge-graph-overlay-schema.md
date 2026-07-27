# Knowledge Graph Overlay Schema

Recommended student overlay source shape. Store it as raw evidence and ingest it into `wiki/pages/graph/student_overlay.md` so doagent `wiki/query` can cite it:

```json
{
  "courseId": "",
  "studentId": "",
  "updatedAt": "",
  "nodes": {
    "node-id": {
      "mastery": 45,
      "reviewPriority": 70,
      "mistakeCount": 1,
      "lastAction": "practice",
      "lastTouchedAt": "",
      "evidence": [],
      "misconceptions": [],
      "recommendedAction": "practice"
    }
  },
  "history": []
}
```

Never replace the course graph. Store only student-specific state in the overlay.
