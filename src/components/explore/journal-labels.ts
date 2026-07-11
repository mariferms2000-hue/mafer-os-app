export const TEMPLATE_LABEL: Record<string, string> = {
  libre: "Escritura libre",
  diaria: "Reflexión diaria",
  semanal: "Reset semanal",
  proyecto: "Reflexión de proyecto",
  decision: "Reflexión de decisión",
  aprendizaje: "Reflexión de aprendizaje",
  gratitud: "Gratitud",
};

/** Preguntas guía por plantilla — aparecen como placeholder, nunca como obligación. */
export const TEMPLATE_PROMPTS: Record<string, string> = {
  libre: "Escribe sin filtro. Nadie más lee esto.",
  diaria: "¿Qué pasó hoy? ¿Qué me llevó energía y qué me la dio? ¿Qué quiero recordar?",
  semanal: "¿Qué avanzó esta semana? ¿Qué suelto? ¿Cuáles son mis 3 focos de la próxima?",
  proyecto: "¿Dónde está este proyecto de verdad? ¿Qué aprendí? ¿Cuál es el siguiente paso?",
  decision: "¿Qué decidí, por qué, y qué esperaría ver si fue una buena decisión?",
  aprendizaje: "¿Qué entendí hoy que ayer no? ¿Qué pregunta nueva apareció?",
  gratitud: "Tres cosas concretas de hoy que estuvieron bien, aunque sean pequeñas.",
};
